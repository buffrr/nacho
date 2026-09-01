"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { Icon } from "@/lib/icons";
import { APP_STORE_URL } from "./ProfileCard";

export default function Home() {
  const [value, setValue] = useState("");
  const router = useRouter();

  function go(raw: string) {
    const handle = raw.trim().toLowerCase();
    if (handle) router.push(`/${handle}`);
  }

  // scroll reveals
  useEffect(() => {
    const io = new IntersectionObserver(
      (ents) =>
        ents.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -12% 0px" },
    );
    document.querySelectorAll(".lp .rise").forEach((el, i) => {
      (el as HTMLElement).style.transitionDelay = `${(i % 4) * 70}ms`;
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp">
      <div className="bg" aria-hidden="true">
        <div className="glow" />
        <div className="dots" />
        <svg className="grain">
          <filter id="n">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={3} />
          </filter>
          <rect width="100%" height="100%" filter="url(#n)" />
        </svg>
      </div>

      <nav>
        <a className="logo" href="/" aria-label="nacho">
          <Logo height={53} />
        </a>
        <div className="navlinks">
          <a href="#what">What&apos;s in a handle</a>
          <a href="#own">Ownership</a>
          <a href="#how">How it works</a>
        </div>
        <a className="btn btn-p" href={APP_STORE_URL}>
          Get the app
        </a>
      </nav>

      <main>
        <div className="hero">

          <p className="hint">
            Self-sovereign irrevocable handles{" "}
            <a
                href="https://spacesprotocol.org"
                target="_blank"
                rel="noopener noreferrer"
                style={{textDecoration: "none", color: "var(--orange)"}}
            >
              anchored in Bitcoin
            </a>
          </p>

          <div className="lookup">
            <form
                className="field"
                autoComplete="off"
                onSubmit={(e) => {
                  e.preventDefault();
                  go(value);
                }}
            >
              <input
                  type="text"
                  placeholder="grace@key"
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                  aria-label="Look up a handle"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
              />
              <button className="btn btn-p" type="submit">
                Look up
              </button>
            </form>
            <div className="examples">
              {["grace@key", "alice@bitcoin"].map((h) => (
                  <button
                      key={h}
                      className="ex"
                      onClick={() => go(h)}
                  >
                    {h}
                  </button>
              ))}
            </div>
          </div>
        </div>

        <section id="what">
          <div className="shead rise">
            <span className="snum">01 — What&apos;s behind a name</span>
            <h2>One name. Everything you want found.</h2>
            <p className="sdesc">
              A handle is a pointer publish what you like behind it.
            </p>
          </div>
          <div className="grid">
            <div className="tile rise">
              <div className="ti" style={{ background: "#FF7B00", color: "#1B0E00" }}>
                <Icon name="bitcoin" size={20} />
              </div>
              <h3>Get paid</h3>
              <p>
                Someone types your handle and get all payment addresses
                associated with it.
              </p>
              <div className="keys">
                addr:btc · addr:sp · addr:ln
                <br />
                addr:liquid · addr:ark
              </div>
            </div>
            <div className="tile rise">
              <div className="ti" style={{ background: "#8B5CF6" }}>
                <Icon name="nostr" size={20} />
              </div>
              <h3>Your socials</h3>
              <p>
                Nostr, X, Bluesky, Instagram, Mastodon, GitHub, Telegram all linked to one handle
              </p>
              <div className="keys">
                nostr · x · bluesky · instagram
                <br />
                mastodon · github · telegram
              </div>
            </div>
            <div className="tile rise">
              <div className="ti" style={{ background: "#4BB77B" }}>
                <Icon name="key" size={20} />
              </div>
              <h3>Your keys</h3>
              <p>
                Publish the public keys people need to verify you, encrypt to you,
                or let you in.
              </p>
              <div className="keys">pgp · ssh · age · did</div>
            </div>
            <div className="tile rise">
              <div className="ti" style={{ background: "#5B9BD5" }}>
                <Icon name="globe" size={20} />
              </div>
              <h3>Your site</h3>
              <p>
                A website, a note, a Tor address, anything you want reachable.
              </p>
              <div className="keys">website · note · tor · hyper</div>
            </div>
          </div>
        </section>

        <section id="own">
          <div className="shead rise">
            <span className="snum">02 — Ownership</span>
            <h2>Every username you have is borrowed.</h2>
            <p className="sdesc">
              Change platforms, break a rule, or watch a company shut down — and
              the name goes with it. Self-sovereign handles stay with you.
            </p>
          </div>
          <div className="vs">
            <div className="vcol bad rise">
              <h3>A username</h3>
              <ul>
                <li><span>✕</span>Lives on somebody&apos;s server</li>
                <li><span>✕</span>Can be suspended, reclaimed or renamed</li>
                <li><span>✕</span>Disappears if the company does</li>
                <li><span>✕</span>Custodial. Not your keys, not your name</li>
              </ul>
            </div>
            <div className="vcol good rise">
              <h3>A nacho handle</h3>
              <ul>
                <li><span>✓</span>Lives on keys only you hold</li>
                <li><span>✓</span>Can&apos;t be closed or taken down — not even by us</li>
                <li><span>✓</span>Ownership anchored in Bitcoin</li>
                <li><span>✓</span>No account, no email, no sign-in</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="how">
          <div className="shead rise">
            <span className="snum">03 — How it works</span>
            <h2>Three steps, then it&apos;s yours.</h2>
          </div>
          <div className="steps rise">
            <div className="step">
              <div className="sn">01</div>
              <h3>Pick a name</h3>
              <p>
                One payment, no
                renewal, no expiry.
              </p>
            </div>
            <div className="step">
              <div className="sn">02</div>
              <h3>Point it somewhere</h3>
              <p>
                Add your payment details, socials, keys and site.
              </p>
            </div>
            <div className="step">
              <div className="sn">03</div>
              <h3>Publish</h3>
              <p>
                Your device signs the records with your key. Anyone who looks you
                up verifies that signature themselves.
              </p>
            </div>
          </div>
        </section>

        <div className="cta" id="get">
          <h2>Take your name with you.</h2>
          <p>One payment. Yours from then on.</p>
          <div className="ctabtns">
            <a className="btn btn-p btn-lg" href={APP_STORE_URL}>
              Download for iPhone
            </a>
            <a className="btn btn-g btn-lg" href="#what">
              See what&apos;s inside a handle
            </a>
          </div>
        </div>
      </main>

      <footer>
        <div className="fin">
          <p>nacho — handles on the Spaces protocol</p>
          <div className="fl">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Support</a>
            <a href="https://spacesprotocol.org" target="_blank" rel="noopener noreferrer">
              Spaces protocol
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
