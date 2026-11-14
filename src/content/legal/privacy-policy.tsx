import { DocLink, Email, type LegalContent } from "@/components/legal/legal-document";
import { legal, operatorSentence } from "@/lib/legal";

const name = legal.tradingName;

/** The Privacy Policy. Facts that may change come from `src/lib/legal.ts`. */
export const privacyPolicy: LegalContent = {
  summary: [
    <>We collect what we need to run your account, pass on your enquiries and check the people who list property.</>,
    <>
      Your contact details are shown only to the person or business you send an enquiry to. We never publish them, and
      we do not sell personal information.
    </>,
    <>We use one cookie, to keep you signed in. There are no advertising, tracking or analytics cookies.</>,
    <>
      You can ask to see, correct or delete your information at any time by writing to <Email to="privacy" />.
    </>,
  ],
  sections: [
    {
      id: "who-we-are",
      title: "Who we are and what this policy covers",
      body: (
        <>
          <p>
            {operatorSentence()} In this policy “{name}”, “we”, “us” and “our” mean the operator of the service, and
            “the Platform” means the website and the mobile applications together.
          </p>
          <p>
            We decide why and how the personal information described here is used, which makes us the “controller” of
            it under data protection law.
            {legal.dataProtectionOfficer && ` Our data protection officer is ${legal.dataProtectionOfficer}.`}
            {legal.ukEuRepresentative && ` Our representative in the United Kingdom or the European Union is ${legal.ukEuRepresentative}.`}
          </p>
          <p>
            This policy explains what we collect when you browse the Platform, create an account, send an enquiry, ask
            for an appointment or a stay, or apply for a professional role. It does not cover what an agent, owner,
            host, solicitor or other business does with your details after they receive your enquiry. They are
            responsible for their own use of them, under their own privacy notices and the law that applies to them.
          </p>
        </>
      ),
    },
    {
      id: "information-we-collect",
      title: "The information we collect",
      body: (
        <>
          <h3>Information you give us</h3>
          <ul>
            <li>
              <strong>Account information:</strong> your name, your email address, your password and the roles you
              choose. We store your password only as a one-way hash, so we cannot read it.
            </li>
            <li>
              <strong>Enquiries and requests:</strong> the message you write, the listing or business it is about, the
              way you want to be contacted, your phone number if you give one, and any date and time you ask for.
            </li>
            <li>
              <strong>Appointments and stay requests:</strong> the times asked for, proposed and agreed, notes, and the
              history of changes such as a confirmation or a cancellation and its reason.
            </li>
            <li>
              <strong>Onboarding details and documents:</strong> if you apply for a professional role, the details the
              application asks for (for example a business name, a registration number, a phone number and the areas
              you cover) and the documents you upload. Depending on the role these can be proof of identity, business
              registration, proof of address, professional certificates and proof of ownership.
            </li>
            <li>
              <strong>Listings and profiles:</strong> the content a Professional publishes about a property, a business
              or themselves.
            </li>
            <li>
              <strong>Messages to us:</strong> what you send when you write to one of our email addresses.
            </li>
          </ul>
          <h3>Information we collect automatically</h3>
          <ul>
            <li>
              <strong>Technical logs:</strong> your IP address, the date and time of each request, the page or action
              requested, basic information about your browser or app, and a request identifier that lets us trace a
              problem.
            </li>
            <li>
              <strong>Email delivery records:</strong> whether an email we sent you was accepted, delivered or returned.
            </li>
            <li>
              <strong>Consent records:</strong> when you agree to this policy or to your details being shared for an
              enquiry, we record that you agreed, when, and which version of this policy applied.
            </li>
          </ul>
          <p>
            We do not ask for, and you should not send us, sensitive information such as details of your health,
            beliefs or bank cards. There is no online payment on the Platform, so we do not collect payment card
            details.
          </p>
        </>
      ),
    },
    {
      id: "how-we-use-information",
      title: "How we use your information",
      body: (
        <>
          <p>We use personal information only for the purposes below, and on the legal grounds shown with each.</p>
          <ul>
            <li>
              <strong>To provide your account and the service you ask for</strong> (performing our agreement with you):
              creating and securing your account, signing you in, showing your enquiries, appointments and
              applications, and sending the emails the service depends on.
            </li>
            <li>
              <strong>To pass your enquiry or request to its recipient</strong> (your consent): each enquiry form asks
              you to agree before your details are shared with the advertiser or business it names.
            </li>
            <li>
              <strong>To verify Professionals</strong> (our legitimate interest, and that of the people who use the
              Platform, in knowing that listings come from real, identified people and businesses): reviewing
              onboarding details and documents and recording the decision.
            </li>
            <li>
              <strong>To keep the Platform safe and working</strong> (our legitimate interest in a secure, reliable
              service): detecting and preventing fraud, spam and abuse, investigating reports, fixing faults and
              keeping records of what happened.
            </li>
            <li>
              <strong>To meet legal duties and handle disputes</strong> (legal obligation, and our legitimate interest
              in defending legal claims): answering lawful requests from authorities and keeping the records the law
              requires.
            </li>
          </ul>
          <p>
            We do not use your information to make decisions about you by automated means alone. Applications for
            professional roles are reviewed by people.
          </p>
        </>
      ),
    },
    {
      id: "who-sees-your-information",
      title: "Who sees your information",
      body: (
        <>
          <ul>
            <li>
              <strong>The recipient of your enquiry or request.</strong> When you send an enquiry, or ask for a
              viewing, a consultation or a stay, your name, your contact details and your message are shown to the
              advertiser or business you sent it to and to the people in their organisation who handle enquiries. They
              are shown to no other user.
            </li>
            <li>
              <strong>The public.</strong> Listings and the profiles of Professionals are public. A profile shows a
              Professional’s name or business name, what they do and where. It never shows a phone number or an email
              address: contact is by enquiry only.
            </li>
            <li>
              <strong>Our staff.</strong> Platform Administrators see the information they need to verify
              applications, moderate content, record invoices and help users.
            </li>
            <li>
              <strong>Service providers that work for us.</strong> We use an email delivery provider (Resend) to send
              our emails, and hosting providers that run the servers and storage the Platform uses. They may handle
              personal information only to provide their service to us, under contract.
            </li>
            <li>
              <strong>Authorities and advisers.</strong> We disclose information when the law requires it, or when it
              is needed to establish or defend a legal claim or to protect someone’s safety.
            </li>
            <li>
              <strong>A new operator.</strong> If the Platform is sold or reorganised, personal information may pass
              to the new operator, who must keep to this policy until they tell you otherwise.
            </li>
          </ul>
          <p>We do not sell personal information, and we do not share it with advertisers.</p>
        </>
      ),
    },
    {
      id: "onboarding-documents",
      title: "Onboarding documents and verification",
      body: (
        <>
          <p>
            Documents uploaded with an application for a professional role are kept in private storage. Only the
            applicant and Platform Administrators can open them. They are never shown on a listing or a profile, and
            each time an administrator opens one it is recorded.
          </p>
          <p>
            Some application details are private too, such as the applicant’s phone number and registration number.
            They are used for verification and are not published.
          </p>
          <p>
            A “Verified” badge on a profile tells other users that we reviewed the documents asked for at onboarding
            and approved the application. It does not reveal the documents themselves.
          </p>
        </>
      ),
    },
    {
      id: "cookies",
      title: "Cookies",
      body: (
        <>
          <p>
            The website sets one cookie, named <code>rp_session</code>, when you sign in. It keeps you signed in and
            cannot be read by scripts in the page. It is strictly necessary for accounts to work, so we do not ask for
            consent to it, and it is removed when you sign out or when it expires.
          </p>
          <p>
            We do not use advertising cookies, third-party tracking cookies or analytics cookies. If that changes, we
            will update this policy and ask for your consent where the law requires it before any such cookie is set.
          </p>
        </>
      ),
    },
    {
      id: "where-information-is-processed",
      title: "Where your information is processed",
      body: (
        <>
          <p>
            The Platform accepts listings and users from many countries. Our servers and the providers named above may
            be in a different country from yours, so your information may be stored and handled outside the country
            where you live, including in countries whose data protection laws differ from those of your own.
          </p>
          <p>
            Where the law requires particular safeguards for such a transfer, such as contractual commitments from the
            recipient, we rely on them. You can ask us for more information at <Email to="privacy" />.
          </p>
        </>
      ),
    },
    {
      id: "how-long-we-keep-information",
      title: "How long we keep information",
      body: (
        <>
          <p>We keep personal information only for as long as we need it for the purposes in this policy.</p>
          <ul>
            <li>Account information is kept while your account is open.</li>
            <li>
              Enquiries, appointments and stay requests are kept so that you and the recipient both have a record of
              what was asked and answered.
            </li>
            <li>
              Onboarding details and documents are kept while the application is being considered and while the role
              it supports is active, and for a limited time afterwards in case of a dispute or a new application.
            </li>
            <li>Technical logs and email delivery records are kept for a limited time and then deleted.</li>
          </ul>
          <p>
            When you ask us to delete your account we delete or anonymise your personal information, except what we
            must keep to meet a legal duty, to resolve a dispute or to prevent fraud, which we keep only for as long
            as that reason lasts. A recipient who has already received your enquiry keeps their own copy of it.
          </p>
        </>
      ),
    },
    {
      id: "how-we-protect-information",
      title: "How we protect information",
      body: (
        <>
          <p>
            We take reasonable technical and organisational steps to protect personal information. Connections to the
            Platform are encrypted, passwords are stored only as hashes, onboarding documents are in private storage,
            and access by our staff is limited to what their role needs.
          </p>
          <p>
            No service can promise perfect security. Choose a password you do not use elsewhere, keep it to yourself,
            and tell us at once at <Email to="support" /> if you think someone else has used your account. If a
            security incident puts your information at risk, we will tell you and the relevant authority as the law
            requires.
          </p>
        </>
      ),
    },
    {
      id: "your-rights",
      title: "Your rights",
      body: (
        <>
          <p>You can ask us to:</p>
          <ul>
            <li>confirm whether we hold personal information about you and give you a copy of it;</li>
            <li>correct information that is wrong or incomplete;</li>
            <li>delete your information, or your whole account;</li>
            <li>stop or limit a use of your information that you object to;</li>
            <li>
              withdraw a consent you gave. This does not undo what was done before you withdrew it: an enquiry already
              passed to its recipient cannot be recalled.
            </li>
          </ul>
          <p>
            Depending on where you live, the law may give you further rights, such as receiving your information in a
            portable form. We honour the rights that the law of your country gives you.
          </p>
          <p>
            To use any of these rights, write to <Email to="privacy" /> from the email address of your account. We may
            ask for information to confirm who you are. We do not charge for a reasonable request, and we answer
            within the time the law allows.
          </p>
          <h3>Complaints</h3>
          <p>
            If you are unhappy with how we handle your information, please tell us first so we can put it right. You
            also have the right to complain to the data protection authority of your country:
          </p>
          <ul>
            <li>
              in Zimbabwe, the Data Protection Authority established under the Cyber and Data Protection Act, which is
              the Postal and Telecommunications Regulatory Authority of Zimbabwe;
            </li>
            <li>in the United Kingdom, the Information Commissioner’s Office;</li>
            <li>
              in the European Economic Area, the supervisory authority of the country where you live or work, under
              the General Data Protection Regulation;
            </li>
            <li>elsewhere, the authority responsible for data protection or privacy where you live.</li>
          </ul>
        </>
      ),
    },
    {
      id: "deleting-your-account",
      title: "Deleting your account",
      body: (
        <>
          <p>
            You can ask us to delete your account, and the personal information linked to it, by writing to{" "}
            <Email to="privacy" /> from the email address of the account. This applies to accounts created on the
            website and in the mobile applications alike. We will confirm when it has been done.
          </p>
          <p>
            The section “How long we keep information” explains what we may have to keep afterwards and why. If you
            are a Professional, your listings and public profile are removed when your account is deleted.
          </p>
        </>
      ),
    },
    {
      id: "children",
      title: "Children",
      body: (
        <p>
          The Platform is for adults. It is not directed at anyone under {legal.minimumAge}, and we do not knowingly
          collect personal information from them. If you believe a child has given us personal information, write to{" "}
          <Email to="privacy" /> and we will delete it.
        </p>
      ),
    },
    {
      id: "emails-from-us",
      title: "Emails from us",
      body: (
        <p>
          We send the emails the service depends on: confirming your email address, resetting your password, telling
          you about an enquiry, an appointment or a stay request, and telling you the outcome of an application. These
          are part of the service and cannot be switched off while you have an account. We do not send marketing
          emails today. If we start, we will ask for your agreement first where the law requires it, and every such
          email will say how to stop them.
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: (
        <p>
          We update this policy when the Platform or the law changes. The date and version at the top show when it
          last changed. If a change significantly affects how we use your information, we will tell you by email or by
          a notice on the Platform before it takes effect. The <DocLink to="termsAndConditions" /> explain the rules
          for using the Platform.
        </p>
      ),
    },
  ],
};
