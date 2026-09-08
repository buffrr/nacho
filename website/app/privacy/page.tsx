import type { Metadata } from "next";
import "./privacy.css";

export const metadata: Metadata = {
  title: "Privacy Policy — nacho",
  description: "How the nacho app handles your data — self-custodial, no accounts.",
};

export default function PrivacyPage() {
  return (
    <main className="privacy">
      <div className="brandrow">
        <div className="mark">@</div>
        <div className="brand">nacho</div>
      </div>

      <h1>Privacy Policy</h1>
      <p className="updated">Last updated: September 8, 2026</p>

      <p>
        nacho (“the app”) is a self-custodial handle and identity app for the
        Spaces protocol, published by Impervious Inc (“we”, “us”). This policy
        explains what information the app handles and how. We built nacho to
        collect as little as possible: <strong>it has no user accounts and
        requires no name, email, phone number, or password.</strong>
      </p>

      <div className="card">
        <strong>The short version.</strong> Your private keys and data stay on
        your device. We don’t operate accounts, run ads, or use third-party
        analytics or tracking. The only information that leaves your device is
        what’s technically required to resolve handles, register a handle, and
        verify a purchase — described below.
      </div>

      <h2>Information stored on your device</h2>
      <ul>
        <li>
          <strong>Keys.</strong> Your cryptographic keys (and seed phrase) are
          generated and stored locally in your device’s secure storage (iOS
          Keychain / Android Keystore-backed secure storage). They{" "}
          <strong>never leave your device</strong> and are never transmitted to
          us or anyone else. Signing happens on-device.
        </li>
        <li>
          <strong>App data.</strong> Your handles, their records, resolve
          history, and settings are stored locally on the device. Any backup you
          create is a file you control and choose where to save.
        </li>
      </ul>

      <h2>Information processed over the network</h2>
      <p>
        Using certain features sends limited technical data to servers so the
        feature can work. This is not tied to any account or personal identity:
      </p>
      <ul>
        <li>
          <strong>Resolving handles.</strong> When you look up or scan a handle,
          the handle name is sent to Spaces-protocol relays and the operator’s
          resolver to fetch its public records and trust status. Standard network
          metadata (such as your IP address) is visible to those servers, as with
          any internet request.
        </li>
        <li>
          <strong>Registering &amp; managing a handle.</strong> Reserving or
          claiming a handle sends the handle name and its public key to the
          operator’s server. No private keys are ever sent.
        </li>
        <li>
          <strong>Purchases.</strong> Handle registration is sold through the
          Apple App Store and Google Play. Those stores process your payment
          under their own privacy policies; we never see your payment details.
          After a purchase, the store’s purchase token is sent to our server only
          to verify and activate that purchase.
        </li>
      </ul>

      <h2>Camera</h2>
      <p>
        The Scan feature uses your camera to read QR codes and printed handles.
        Camera frames are processed <strong>entirely on your device</strong> and
        are never uploaded or stored. The camera is only active while the Scan
        screen is open.
      </p>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not create accounts or collect names, emails, or phone numbers.</li>
        <li>
          We do not use third-party advertising or analytics SDKs, and we do not
          track you across apps or websites.
        </li>
        <li>We do not collect precise location or your contacts.</li>
        <li>We do not sell or rent personal information.</li>
      </ul>

      <h2>Third parties</h2>
      <p>Depending on the features you use, data is handled by:</p>
      <ul>
        <li>
          <strong>Apple / Google</strong> — app distribution and in-app
          purchases.
        </li>
        <li>
          <strong>Spaces-protocol relays and the handle operator</strong> —
          resolving and registering handles.
        </li>
      </ul>

      <h2>Data retention</h2>
      <p>
        On-device data remains until you delete it in the app, erase your
        keystore, or uninstall the app. Requests to resolver and operator servers
        may be retained by those services per their own policies (for example,
        transient logs).
      </p>

      <h2>Security</h2>
      <p>
        Private keys are held in the operating system’s secure storage and never
        transmitted. Network requests use encrypted (HTTPS) connections. No
        method of storage or transmission is perfectly secure, but we design the
        app to keep sensitive material on your device and under your control.
      </p>

      <h2>Children</h2>
      <p>
        nacho is not directed to children under 13, and we do not knowingly
        collect information from them.
      </p>

      <h2>Your choices</h2>
      <p>
        Because there is no account, you control your data directly: delete
        individual handles or your resolve history in the app, erase your
        keystore, or uninstall the app to remove local data from your device.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Material changes will be
        reflected here with a new “Last updated” date.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Email{" "}
        <a href="mailto:support@impervious.com">support@impervious.com</a>.
      </p>

      <hr />
      <p className="fin">© 2026 Impervious Inc · nacho.io</p>
    </main>
  );
}
