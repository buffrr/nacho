import type { Metadata } from "next";
import "../privacy/privacy.css";

export const metadata: Metadata = {
  title: "Terms of Service — nacho",
  description: "The terms for using the nacho app and handle service.",
};

export default function TermsPage() {
  return (
    <main className="privacy">
      <div className="brandrow">
        <div className="mark">@</div>
        <div className="brand">nacho</div>
      </div>

      <h1>Terms of Service</h1>
      <p className="updated">Last updated: September 8, 2026</p>

      <p>
        These Terms of Service (“Terms”) govern your use of the nacho app and
        related services (“nacho”, “the app”), published by Impervious Inc (“we”,
        “us”). By downloading or using the app, you agree to these Terms. If you
        don’t agree, don’t use the app.
      </p>

      <h2>What nacho is</h2>
      <p>
        nacho is a <strong>self-custodial</strong> handle and identity app for
        the Spaces protocol — human-readable handles anchored on Bitcoin,
        analogous to DNS. nacho is <strong>not</strong> a wallet, exchange,
        custodian, or money-transmission service. It does not hold, send, or
        receive funds, and nothing in the app is financial, investment, legal, or
        tax advice. A handle may publish public information (such as a Bitcoin or
        Lightning address); the app only displays it and hands off to your own
        external wallet — it never moves funds itself.
      </p>

      <h2>Your keys and your responsibility</h2>
      <ul>
        <li>
          Your keys and seed phrase are generated and stored{" "}
          <strong>only on your device</strong>. We never receive them and{" "}
          <strong>cannot recover them</strong>.
        </li>
        <li>
          You are solely responsible for safeguarding your seed phrase and
          backups. If you lose them, you may permanently lose access to your
          handles, and no one — including us — can restore that access.
        </li>
        <li>
          You are responsible for the handles you register and the records you
          publish under them.
        </li>
      </ul>

      <h2>Handles and registration</h2>
      <p>
        Registering a handle is a purchase made through the Apple App Store or
        Google Play. Handles are anchored on a decentralized network via the
        Spaces protocol and operated by third-party relays and a handle operator.
        We do not guarantee that any particular handle will be available, or that
        the network, relays, or operator will be available or uninterrupted.
      </p>

      <h2>Purchases and refunds</h2>
      <p>
        All in-app purchases are processed by Apple or Google under their terms,
        and refunds are subject to the applicable app store’s refund policy. We
        do not accept or process cryptocurrency for payment anywhere in the app.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to use nacho to:</p>
      <ul>
        <li>violate any law or regulation, or infringe anyone’s rights;</li>
        <li>impersonate a person or organization, or register handles in bad faith;</li>
        <li>distribute malware, or interfere with or abuse the app, relays, or operator services;</li>
        <li>publish unlawful, harmful, or fraudulent content in your records.</li>
      </ul>

      <h2>Third-party services</h2>
      <p>
        nacho relies on services we don’t control — the app stores, Spaces-protocol
        relays, and the handle operator. Your use of those is subject to their own
        terms, and we’re not responsible for their acts, omissions, or
        availability.
      </p>

      <h2>Disclaimers</h2>
      <p>
        The app is provided <strong>“as is” and “as available,” without
        warranties of any kind</strong>, to the fullest extent permitted by law.
        We do not warrant that the app will be uninterrupted, error-free, or
        secure, or that handle resolution or registration will always succeed.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Impervious Inc will not be liable
        for any indirect, incidental, special, consequential, or punitive
        damages, or for any loss of keys, handles, data, or profits, arising from
        or related to your use of the app.
      </p>

      <h2>Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be
        reflected here with a new “Last updated” date; continuing to use the app
        means you accept the updated Terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms? Email{" "}
        <a href="mailto:support@impervious.com">support@impervious.com</a>.
      </p>

      <hr />
      <p className="fin">© 2026 Impervious Inc · nacho.io</p>
    </main>
  );
}
