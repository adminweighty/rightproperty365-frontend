import { DocLink, Email, type LegalContent } from "@/components/legal/legal-document";
import { legal, operatorSentence } from "@/lib/legal";

const name = legal.tradingName;

/** The Terms and Conditions. Facts that may change come from `src/lib/legal.ts`. */
export const termsAndConditions: LegalContent = {
  summary: [
    <>
      {name} is a place to advertise and find property and property professionals. We are not a party to any sale,
      lease, booking or service you arrange through it.
    </>,
    <>
      An enquiry, an appointment request or a request to stay is a request. It becomes an agreement only when you and
      the other person make one between yourselves.
    </>,
    <>
      “Verified” means we reviewed the documents asked for at onboarding. It is not a guarantee about a person, a
      property or a price.
    </>,
    <>Listings must be accurate, lawful and posted by someone entitled to post them.</>,
    <>There is no online payment on {name}. Never send money to us for a property, and take care before paying anyone.</>,
  ],
  sections: [
    {
      id: "who-we-are",
      title: "Who we are",
      body: (
        <>
          <p>
            {operatorSentence()} In these terms “{name}”, “we”, “us” and “our” mean the operator of the service.
          </p>
          <p>These words have a fixed meaning in these terms:</p>
          <ul>
            <li>
              <strong>Platform:</strong> the website at {legal.website}, the {name} mobile applications, and the
              services we provide through them.
            </li>
            <li>
              <strong>Listing:</strong> an advertisement for a property for sale, to rent or for a short stay,
              including commercial property and land.
            </li>
            <li>
              <strong>Professional:</strong> a user with a role that lists property or offers services, such as an
              Estate Agent, a Solicitor, a Landlord, a Host or a Property Service Provider.
            </li>
            <li>
              <strong>Content:</strong> anything a user puts on the Platform, including Listings, profiles, photos,
              messages and documents.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "acceptance-and-changes",
      title: "Accepting and changing these terms",
      body: (
        <>
          <p>
            By using the Platform you agree to these terms. If you create an account you confirm that agreement when
            you register. If you do not agree, do not use the Platform.
          </p>
          <p>
            These terms sit alongside our <DocLink to="privacyPolicy" />, our <DocLink to="refundPolicy" /> and, for
            the applications, our <DocLink to="eula" />.
          </p>
          <p>
            We may change these terms when the Platform or the law changes. The date and version at the top show when
            they last changed. If a change significantly affects your rights, we will tell you by email or by a notice
            on the Platform a reasonable time before it takes effect. If you keep using the Platform after a change
            takes effect, you accept it. If you do not accept it, stop using the Platform and ask us to close your
            account.
          </p>
        </>
      ),
    },
    {
      id: "eligibility",
      title: "Who can use the Platform",
      body: (
        <p>
          You must be at least {legal.minimumAge} years old and able to enter into a binding agreement. If you use the
          Platform for a business, you confirm that you are authorised to act for it, and these terms bind the
          business as well as you. You may not use the Platform if we have closed your account for breaking these
          terms, or if the law of your country forbids it.
        </p>
      ),
    },
    {
      id: "accounts",
      title: "Your account and its security",
      body: (
        <>
          <p>
            You can search Listings, find Professionals and send an enquiry without an account. Some features need
            one, such as seeing your appointments or applying for a professional role.
          </p>
          <ul>
            <li>Give accurate information when you register and keep it up to date.</li>
            <li>Confirm your email address when we ask you to.</li>
            <li>Keep your password secret and do not let anyone else use your account.</li>
            <li>
              Tell us at once at <Email to="support" /> if you think someone else has used your account.
            </li>
          </ul>
          <p>You are responsible for what is done through your account until you tell us it has been misused.</p>
        </>
      ),
    },
    {
      id: "roles-and-verification",
      title: "Roles, onboarding and verification",
      body: (
        <>
          <p>
            When you register you choose one or more roles. The roles for Property Seekers (Prospective Buyer and
            Prospective Tenant) are active straight away.
          </p>
          <p>
            Every other role is a professional role: Estate Agent, Sales Agent, Lettings Agent, Property Manager,
            Solicitor, Agency Principal, Agency Administrator, Agency Staff, Landlord, Property Seller (Vendor), Host,
            Property Developer and Property Service Provider. A professional role is not active until you complete
            onboarding and a Platform Administrator approves your application. Onboarding asks for details and
            documents that depend on the role, such as proof of identity, business registration, proof of address,
            professional certificates and proof of ownership.
          </p>
          <ul>
            <li>The details and documents you give must be genuine, current and your own or your organisation’s.</li>
            <li>We may ask for more information, ask for changes, or refuse an application.</li>
            <li>
              We may review a role again at any time and suspend or remove it if the information behind it is no
              longer true.
            </li>
          </ul>
          <p>
            <strong>What “Verified” means.</strong> A “Verified” badge means that we reviewed the documents described
            at onboarding and approved the application. It is not a warranty. It does not mean that we have inspected
            a property, confirmed who owns it, checked a licence with a regulator on an ongoing basis, or vouch for
            how a Professional will behave. Make your own checks before you rely on anyone.
          </p>
        </>
      ),
    },
    {
      id: "our-role",
      title: "What we do and do not do",
      body: (
        <>
          <p>
            The Platform is an advertising and introduction service. Professionals advertise property and services,
            and other users find them and send enquiries.
          </p>
          <ul>
            <li>
              We are not a party to any sale, lease, tenancy, booking or service contract between users, and we are
              not the agent of any user.
            </li>
            <li>We are not an estate agent, a lawyer, a valuer, a surveyor or a financial adviser.</li>
            <li>We do not hold client money, deposits, rent, purchase money or booking payments.</li>
            <li>
              We do not guarantee that a Listing is accurate, that a property is available or is as described, that a
              price is fair, that a seller or landlord has good title, or that any user will do what they say.
            </li>
          </ul>
          <p>
            Listings show the currency chosen by the person who posted them. We do not convert prices or advise on
            exchange rates.
          </p>
        </>
      ),
    },
    {
      id: "listings-and-content",
      title: "Listings and other content",
      body: (
        <>
          <p>If you post a Listing or any other Content, you confirm that:</p>
          <ul>
            <li>
              you own the property or the business, or you are authorised by the owner to advertise it, and you can
              show that if we ask;
            </li>
            <li>
              the Content is accurate and not misleading, including the price, the location, the size, the photos and
              whether the property is still available;
            </li>
            <li>
              the Content is lawful where the property is and where it is advertised, and you hold any licence or
              registration that the advertisement needs;
            </li>
            <li>
              the Content does not discriminate unlawfully against anyone, for example because of race, ethnic origin,
              sex, religion, disability, age or family status;
            </li>
            <li>you own the photos and text, or have the right to use them.</li>
          </ul>
          <p>Content must not be fraudulent, offensive, defamatory or an advertisement for something else.</p>
          <p>
            Listings are published for a limited period and expire at the end of it. Update or remove a Listing as
            soon as the property is sold, let or withdrawn. We may edit the presentation of Content, refuse it, or
            remove it at any time if we believe it breaks these terms or the law, or if it has been reported and we
            cannot confirm it. We do not check every Listing before it appears and we are not obliged to.
          </p>
        </>
      ),
    },
    {
      id: "enquiries-and-requests",
      title: "Enquiries, appointments and requests to stay",
      body: (
        <>
          <p>
            Contact on the Platform is by enquiry. We do not publish the phone numbers or email addresses of
            Professionals. When you send an enquiry, your contact details are shown only to the person or business
            you sent it to, as the <DocLink to="privacyPolicy" /> explains.
          </p>
          <ul>
            <li>
              An enquiry, a request for a viewing or a consultation, and a request to stay are requests. None of them
              is a contract, a reservation or a confirmed booking.
            </li>
            <li>
              An appointment shown as confirmed records that the Professional accepted the time. Keeping it is a
              matter between you and them.
            </li>
            <li>
              The availability shown for a short stay is set by the Host or other lister. It is information, not a
              guarantee that the property is free on those dates.
            </li>
            <li>
              We pass enquiries on and record them. We cannot promise that the recipient will reply, or when.
            </li>
          </ul>
          <p>
            Any agreement that follows, and any money paid under it, is between you and the other person. Read the{" "}
            <DocLink to="refundPolicy" section="payments-between-users">
              Refund Policy
            </DocLink>{" "}
            before you pay anyone you met through the Platform.
          </p>
        </>
      ),
    },
    {
      id: "prohibited-use",
      title: "What you must not do",
      body: (
        <>
          <p>You must not:</p>
          <ul>
            <li>
              copy, scrape or harvest Listings, profiles or other data from the Platform by automated means, or build
              a database from them, without our written permission;
            </li>
            <li>send spam, chain messages or advertising through enquiries, or send enquiries you do not mean;</li>
            <li>
              try to get round the enquiry system, for example by putting phone numbers, email addresses or links in
              Listings or profiles where they are not asked for;
            </li>
            <li>harass, threaten, abuse or deceive another user or our staff;</li>
            <li>pretend to be another person or business, or misstate your connection with one;</li>
            <li>post Content that is fraudulent or misleading, or advertise a property you have no right to advertise;</li>
            <li>upload malware or anything else meant to damage or interfere with a system;</li>
            <li>
              probe, overload or attack the Platform, access parts of it you are not entitled to, or use another
              person’s account;
            </li>
            <li>use the Platform for money laundering, fraud or any other unlawful purpose;</li>
            <li>use contact details received through an enquiry for anything other than answering that enquiry.</li>
          </ul>
        </>
      ),
    },
    {
      id: "professional-users",
      title: "Responsibilities of Professionals",
      body: (
        <>
          <p>If you hold a professional role, you also agree to:</p>
          <ul>
            <li>
              hold, and keep in force, every licence, registration, practising certificate and insurance that your
              work requires in each place where you do it;
            </li>
            <li>
              comply with the estate agency, legal practice, consumer protection, advertising, data protection,
              anti-money-laundering and tax laws that apply to you;
            </li>
            <li>answer enquiries and appointment requests promptly and honestly;</li>
            <li>keep Listings, prices and availability calendars up to date;</li>
            <li>
              use a customer’s details only to deal with their enquiry, keep them secure, and handle them as the data
              protection law that applies to you requires;
            </li>
            <li>tell us at once if a licence or registration lapses, or if anything in your application stops being true.</li>
          </ul>
          <p>
            An Agency Principal or Agency Administrator is responsible for the people they add to their organisation
            on the Platform and for what those people post.
          </p>
        </>
      ),
    },
    {
      id: "fees",
      title: "Fees and subscriptions",
      body: (
        <>
          <p>
            Searching the Platform and sending enquiries is free. We may offer Professionals paid subscriptions and
            promoted placements. Where we do, the price, the period and what is included are stated on the invoice or
            the written offer we send, and that document forms part of our agreement with you.
          </p>
          <p>
            There is no online payment on the website or in the mobile applications. Fees are invoiced and paid
            outside them, by bank transfer or another method stated on the invoice, and are recorded by Platform
            Administrators. Taxes and bank charges are payable in addition where they apply. A promoted placement is
            labelled “Sponsored” wherever it appears.
          </p>
          <p>
            The <DocLink to="refundPolicy" /> says when a fee paid to us is refunded.
          </p>
        </>
      ),
    },
    {
      id: "intellectual-property",
      title: "Intellectual property and your content",
      body: (
        <>
          <p>
            The Platform, including its software, design, text, logos and the {name} name, belongs to us or to those
            who license it to us. You may use the Platform for its purpose under these terms. Nothing here gives you
            any other right in it.
          </p>
          <p>
            You keep ownership of your Content. By posting it you give us a non-exclusive, worldwide, royalty-free
            licence to host, store, copy, format, display and distribute it on the Platform and in material that
            promotes the Platform or your Listing, for as long as the Content is on the Platform and for a reasonable
            time afterwards while it is removed from our systems and backups. You may remove your Content at any time.
          </p>
          <p>
            If you believe Content on the Platform infringes your rights, write to <Email to="legal" /> with details
            of the Content, your rights in it and how to reach you.
          </p>
        </>
      ),
    },
    {
      id: "third-party-services",
      title: "Third-party services and links",
      body: (
        <p>
          The Platform relies on services provided by others, such as hosting and email delivery, and Content may link
          to websites we do not control. We are not responsible for third-party websites or for services we do not
          provide. Your use of them is governed by their own terms.
        </p>
      ),
    },
    {
      id: "no-professional-advice",
      title: "No professional advice",
      body: (
        <p>
          Nothing on the Platform is legal, financial, tax, valuation or investment advice. Information in a Listing
          or a profile comes from the user who posted it. Before you buy, sell, let, rent or book, take advice from a
          suitably qualified professional, inspect the property, and check ownership and any documents yourself or
          through a Solicitor.
        </p>
      ),
    },
    {
      id: "disclaimers",
      title: "Disclaimers",
      body: (
        <>
          <p>
            We provide the Platform with reasonable care and skill. Beyond that, and as far as the law allows, the
            Platform is provided “as is” and “as available”. We do not promise that it will always be available,
            uninterrupted, secure or free of errors, or that it will meet your particular needs.
          </p>
          <p>
            We are not responsible for the accuracy of Content posted by users, for the condition, legality or
            availability of any property or service, or for the acts or omissions of any user, whether or not their
            role has been verified.
          </p>
        </>
      ),
    },
    {
      id: "liability",
      title: "Limits on our liability",
      body: (
        <>
          <p>
            Nothing in these terms excludes or limits liability that cannot be excluded or limited by law. That
            includes liability for death or personal injury caused by negligence, for fraud, and for rights that
            consumer protection law gives you and does not allow to be removed.
          </p>
          <p>Subject to that, and as far as the law allows:</p>
          <ul>
            <li>
              we are not liable for loss arising from a dealing between users, including money paid to another user,
              a property that is not as described, or a sale, lease, booking or service that does not go ahead;
            </li>
            <li>
              we are not liable for loss of profit, business, opportunity or data, or for indirect or consequential
              loss;
            </li>
            <li>
              our total liability to you for all claims connected with the Platform is limited to the fees you paid
              to us in the {legal.liabilityCapMonths} months before the event that gave rise to the claim. If you have
              paid us no fees, we are liable only for loss that the law does not allow us to exclude;
            </li>
            <li>we are not liable for a failure or delay caused by something outside our reasonable control.</li>
          </ul>
        </>
      ),
    },
    {
      id: "indemnity",
      title: "Your responsibility to us",
      body: (
        <p>
          If someone brings a claim against us because of Content you posted, because of how you dealt with another
          user, or because you broke these terms or the law, you agree to compensate us for the reasonable losses and
          costs we incur as a result, including reasonable legal costs. This applies only as far as the law allows,
          and does not apply to the extent that we caused the loss.
        </p>
      ),
    },
    {
      id: "suspension-and-termination",
      title: "Suspension and closing accounts",
      body: (
        <>
          <p>
            You may stop using the Platform at any time, and you may ask us to close your account by writing to{" "}
            <Email to="support" />. The <DocLink to="privacyPolicy" section="deleting-your-account">Privacy Policy</DocLink>{" "}
            explains how to have your personal information deleted.
          </p>
          <p>
            We may remove Content, suspend a role or an account, or close an account if we reasonably believe that you
            have broken these terms or the law, that your account is being misused, or that it is necessary to protect
            other users or the Platform. Where we can, we will tell you why and give you the chance to respond. We may
            act without notice where the matter is serious or urgent.
          </p>
          <p>
            We may also withdraw the Platform or any part of it. If we do, we will give reasonable notice where we
            can. The sections of these terms that by their nature should continue, such as those on Content,
            liability and disputes, continue after your account is closed.
          </p>
        </>
      ),
    },
    {
      id: "privacy",
      title: "Privacy",
      body: (
        <p>
          Our <DocLink to="privacyPolicy" /> explains what personal information we collect, why, who sees it and the
          rights you have over it. If you receive another person’s details through the Platform, you are responsible
          for handling them lawfully.
        </p>
      ),
    },
    {
      id: "governing-law-and-disputes",
      title: "Governing law and disputes",
      body: (
        <>
          <p>
            If you have a complaint, please write to <Email to="support" /> first. We will try to resolve it with you.
          </p>
          <p>
            These terms are governed by {legal.governingLaw}, and disputes connected with them or with the Platform
            will be heard by {legal.courts}. If you are a consumer, this does not take away any protection or any
            right to bring a claim in your own country that the law of the place where you live gives you and does not
            allow to be removed by agreement.
          </p>
          <p>
            Disputes between users, for example between a Prospective Tenant and a Landlord, are for those users to
            resolve. We are not obliged to take part, although we may act on a report under these terms.
          </p>
        </>
      ),
    },
    {
      id: "general",
      title: "General",
      body: (
        <ul>
          <li>
            <strong>Whole agreement.</strong> These terms, the documents they refer to, and any invoice or written
            offer we send you are the whole agreement between you and us about the Platform.
          </li>
          <li>
            <strong>Severability.</strong> If a court finds part of these terms invalid or unenforceable, the rest
            still applies.
          </li>
          <li>
            <strong>No waiver.</strong> If we do not enforce a term at once, we may still enforce it later.
          </li>
          <li>
            <strong>Transfer.</strong> You may not transfer your account or your rights under these terms to anyone
            else. We may transfer ours to a successor that takes over the Platform.
          </li>
          <li>
            <strong>Third parties.</strong> These terms are between you and us. No one else has a right to enforce
            them, except as the <DocLink to="eula" /> provides for application stores.
          </li>
          <li>
            <strong>Notices.</strong> We send notices to the email address of your account. Send legal notices to us
            at <Email to="legal" />.
          </li>
        </ul>
      ),
    },
  ],
};
