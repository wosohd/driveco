import "server-only";

import {
  getAppBaseUrl,
  paymentProviderEnvironment,
} from "@/lib/payments/config";

type MpesaCredentials = {
  consumerKey: string;

  consumerSecret: string;

  shortcode: string;

  passkey: string;

  transactionType:
    | "CustomerPayBillOnline"
    | "CustomerBuyGoodsOnline";
};

type MpesaTokenResponse = {
  access_token?: string;

  expires_in?: string;
};

type MpesaStkResponse = {
  MerchantRequestID?: string;

  CheckoutRequestID?: string;

  ResponseCode?: string;

  ResponseDescription?: string;

  CustomerMessage?: string;

  errorCode?: string;

  errorMessage?: string;
};

export type MpesaStkResult = {
  accepted: boolean;

  checkoutRequestId:
    string | null;

  merchantRequestId:
    string | null;

  message:
    string;
};

/* ---------------------------------------
   Provider Configuration
--------------------------------------- */

function getCredentials():
  MpesaCredentials {
  const consumerKey =
    process.env
      .MPESA_CONSUMER_KEY;

  const consumerSecret =
    process.env
      .MPESA_CONSUMER_SECRET;

  const shortcode =
    process.env
      .MPESA_SHORTCODE;

  const passkey =
    process.env
      .MPESA_PASSKEY;

  const requestedType =
    process.env
      .MPESA_TRANSACTION_TYPE;

  if (
    !consumerKey ||
    !consumerSecret ||
    !shortcode ||
    !passkey
  ) {
    throw new Error(
      "M-Pesa payment credentials are incomplete.",
    );
  }

  const transactionType =
    requestedType ===
    "CustomerBuyGoodsOnline"
      ? "CustomerBuyGoodsOnline"
      : "CustomerPayBillOnline";

  return {
    consumerKey,
    consumerSecret,
    shortcode,
    passkey,
    transactionType,
  };
}

function getBaseUrl() {
  return paymentProviderEnvironment ===
    "live"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

/* ---------------------------------------
   Kenyan Phone Number
--------------------------------------- */

export function normalizeKenyanPhone(
  value:
    string,
) {
  const digits =
    value.replace(
      /\D/g,
      "",
    );

  let normalized =
    digits;

  if (
    normalized.startsWith(
      "0",
    )
  ) {
    normalized =
      `254${normalized.slice(
        1,
      )}`;
  } else if (
    normalized.startsWith(
      "7",
    ) ||
    normalized.startsWith(
      "1",
    )
  ) {
    normalized =
      `254${normalized}`;
  }

  if (
    !/^254(7|1)\d{8}$/.test(
      normalized,
    )
  ) {
    throw new Error(
      "Enter a valid Kenyan M-Pesa phone number.",
    );
  }

  return normalized;
}

/* ---------------------------------------
   Nairobi Timestamp
--------------------------------------- */

function createTimestamp() {
  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Africa/Nairobi",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hour12:
          false,
      },
    );

  const parts =
    formatter.formatToParts(
      new Date(),
    );

  const values =
    Object.fromEntries(
      parts.map(
        ({
          type,
          value,
        }) => [
          type,
          value,
        ],
      ),
    );

  return [
    values.year,
    values.month,
    values.day,
    values.hour,
    values.minute,
    values.second,
  ].join("");
}

/* ---------------------------------------
   OAuth
--------------------------------------- */

async function getAccessToken() {
  const credentials =
    getCredentials();

  const authorization =
    Buffer.from(
      `${credentials.consumerKey}:${credentials.consumerSecret}`,
    ).toString(
      "base64",
    );

  const response =
    await fetch(
      `${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method:
          "GET",

        headers: {
          Authorization:
            `Basic ${authorization}`,
        },

        cache:
          "no-store",

        signal:
          AbortSignal.timeout(
            15_000,
          ),
      },
    );

  if (!response.ok) {
    throw new Error(
      "M-Pesa authorization failed.",
    );
  }

  const result =
    (await response.json()) as
      MpesaTokenResponse;

  if (
    !result.access_token
  ) {
    throw new Error(
      "M-Pesa did not return an access token.",
    );
  }

  return result.access_token;
}

/* ---------------------------------------
   STK Push
--------------------------------------- */

export async function initiateMpesaStkPush(
  options: {
    phoneNumber:
      string;

    amountKes:
      number;

    accountReference:
      string;

    description:
      string;
  },
): Promise<MpesaStkResult> {
  const credentials =
    getCredentials();

  const token =
    await getAccessToken();

  const phoneNumber =
    normalizeKenyanPhone(
      options.phoneNumber,
    );

  const timestamp =
    createTimestamp();

  const password =
    Buffer.from(
      `${credentials.shortcode}${credentials.passkey}${timestamp}`,
    ).toString(
      "base64",
    );

  const callbackUrl =
    `${getAppBaseUrl()}/api/payments/mpesa/callback`;

  const response =
    await fetch(
      `${getBaseUrl()}/mpesa/stkpush/v1/processrequest`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            BusinessShortCode:
              credentials.shortcode,

            Password:
              password,

            Timestamp:
              timestamp,

            TransactionType:
              credentials.transactionType,

            Amount:
              Math.round(
                options.amountKes,
              ),

            PartyA:
              phoneNumber,

            PartyB:
              credentials.shortcode,

            PhoneNumber:
              phoneNumber,

            CallBackURL:
              callbackUrl,

            AccountReference:
              options.accountReference.slice(
                0,
                12,
              ),

            TransactionDesc:
              options.description.slice(
                0,
                13,
              ),
          }),

        cache:
          "no-store",

        signal:
          AbortSignal.timeout(
            20_000,
          ),
      },
    );

  let result:
    MpesaStkResponse;

  try {
    result =
      (await response.json()) as
        MpesaStkResponse;
  } catch {
    throw new Error(
      "M-Pesa returned an invalid response.",
    );
  }

  if (
    !response.ok
  ) {
    throw new Error(
      result.errorMessage ??
        "M-Pesa rejected the payment request.",
    );
  }

  const accepted =
    result.ResponseCode ===
    "0";

  return {
    accepted,

    checkoutRequestId:
      result.CheckoutRequestID ??
      null,

    merchantRequestId:
      result.MerchantRequestID ??
      null,

    message:
      result.CustomerMessage ??
      result.ResponseDescription ??
      "M-Pesa payment request received.",
  };
}