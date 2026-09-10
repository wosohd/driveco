import ApplicationForm from "@/components/application-form";

export default function Home() {
  return (
    <main className="site-shell">
      {/* Header */}
      <header className="site-header">
        <div className="container header-inner">
          <a href="/" className="brand" aria-label="DriveCo home">
            DriveCo
          </a>

          <nav className="header-nav" aria-label="Main navigation">
            <a href="#about" className="nav-link">
              About DriveCo
            </a>

            <div className="language-wrapper">
              <label htmlFor="language" className="sr-only">
                Select language
              </label>

              <select
                id="language"
                name="language"
                className="language-select"
                defaultValue="en"
                aria-label="Select language"
              >
                <option value="en">English</option>
                <option value="sw">Kiswahili</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="es">Español</option>
                <option value="ar">العربية</option>
              </select>
            </div>
          </nav>
        </div>
      </header>

      {/* Introduction */}
      <section className="application-intro" id="about">
        <div className="container content-width">
          <p className="eyebrow">Driver Applications · Kenya</p>

          <h1>Driver Application</h1>

          <p className="intro-text">
            DriveCo is accepting applications from qualified Kenyan drivers.
            Complete the application form below and provide the requested
            information to be considered for available driving opportunities.
          </p>
        </div>
      </section>

      {/* Application */}
      <section className="application-area" id="application">
        <div className="container content-width">
          <div className="application-heading">
            <p className="section-label">Application form</p>

            <h2>Complete your application</h2>

            <p className="application-heading-text">
              Complete each section of the form. Fields marked with an asterisk
              are required.
            </p>
          </div>

          <ApplicationForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-main">
            <div className="footer-brand-area">
              <a href="/" className="footer-brand" aria-label="DriveCo home">
                DriveCo
              </a>

              <p className="footer-description">
                Driver recruitment opportunities for qualified Kenyan drivers.
              </p>
            </div>

            <div className="footer-navigation">
              <div className="footer-column">
                <p className="footer-heading">DriveCo</p>

                <a href="#about" className="footer-link">
                  About DriveCo
                </a>

                <a href="#application" className="footer-link">
                  Driver Applications
                </a>
              </div>

              <div className="footer-column">
                <p className="footer-heading">Information</p>

                <a href="#" className="footer-link">
                  Privacy
                </a>

                <a href="#" className="footer-link">
                  Terms
                </a>

                <a href="#" className="footer-link">
                  Accessibility
                </a>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© 2026 DriveCo. All rights reserved.</p>

            <p>Nairobi, Kenya</p>
          </div>
        </div>
      </footer>
    </main>
  );
}