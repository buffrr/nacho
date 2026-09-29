import type { Metadata } from "next";
import { Logo } from "../Logo";
import "./registry.css";

export const metadata: Metadata = {
  title: "Registry",
  description:
    "The nacho registry operates top-level spaces on the Spaces protocol, including @bitcoin and @orbee.",
};

export default function RegistryPage() {
  return (
    <div className="lp lp-sub">
      <nav>
        <div className="navinner">
          <a className="logo" href="/" aria-label="nacho">
            <Logo height={44} />
          </a>
          <a className="btn btn-p" href="/#get">
            Get the app
          </a>
        </div>
      </nav>

      <main>
        <article className="regdoc">
          <h1>The Nacho registry</h1>
          <p className="kicker">Operating top-level spaces on the Spaces protocol</p>

          <p>
            Nacho, operated by Impervious Inc, runs the registry for a set of
            top-level spaces on the{" "}
            <a
              href="https://spacesprotocol.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              Spaces protocol
            </a>
            , a Bitcoin-anchored naming protocol. A top-level space (such as{" "}
            <strong>@bitcoin</strong>) is acquired through a permissionless
            Bitcoin auction, and its operator issues the handles under it.
          </p>
          <p>
            Handles are issued in batches. Each batch is committed to Bitcoin as
            a single Merkle root, and every handle carries an inclusion proof
            back to that on-chain root. Records live off-chain on relays and
            verify against the Bitcoin-anchored root, so no server has to be
            trusted. As operator we run this work: producing the proofs,
            committing the batches, and keeping resolution available. Handles
            stay self-custodial. Only you hold the keys that sign your records.
          </p>

          <div className="card">
            <strong>Now operating.</strong> The registry currently manages{" "}
            <strong>@bitcoin</strong> and <strong>@orbee</strong>. More spaces
            are on the way.
          </div>

          <h2>Operate a space with us</h2>
          <p>
            If you hold a top-level space and want us to operate it (issuing
            handles, committing batches to Bitcoin, and running resolution),
            contact{" "}
            <a href="mailto:support@impervious.com">support@impervious.com</a>{" "}
            with the details of your space.
          </p>

          <hr />
          <p className="fin">© 2026 Impervious Inc · nacho.io</p>
        </article>
      </main>

      <footer>
        <div className="fin">
          <p>nacho — handles on the Spaces protocol</p>
          <div className="fl">
            <a href="/">Home</a>
            <a
              href="https://spacesprotocol.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              Spaces protocol
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
