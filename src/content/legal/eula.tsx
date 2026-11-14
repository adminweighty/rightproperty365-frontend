import { DocLink, Email, type LegalContent } from "@/components/legal/legal-document";
import { legal, operatorSentence } from "@/lib/legal";

const name = legal.tradingName;
const licensor = legal.legalEntity ?? name;

/** The End User Licence Agreement. Facts that may change come from `src/lib/legal.ts`. */
export const eula: LegalContent = {
  summary: [
    <>You may install and use the {name} applications for their purpose. You do not own the software.</>,
    <>The applications are free. There are no in-app purchases and no payments inside them.</>,
    <>
      This agreement is between you and {name}. Apple and Google are not parties to it and are not responsible for the
      applications.
    </>,
    <>
      You can ask us to delete your account at any time by writing to <Email to="privacy" />.
    </>,
  ],
  sections: [
    {
      id: "about-this-agreement",
      title: "About this agreement",
      body: (
        <>
          <p>
            {operatorSentence()} In this agreement “{name}”, “we”, “us” and “our” mean the operator of the service,
            and “the Application” means the {name} mobile applications for iOS and Android, the {name} web
            application, and any update to them that we provide.
          </p>
          <p>
            This agreement is a licence to use the Application. By installing or using it you agree to this agreement.
            If you do not agree, do not install or use it. The service you reach through the Application is governed
            by our <DocLink to="termsAndConditions" />, which apply together with this agreement. If the two conflict
            about the software itself, this agreement applies.
          </p>
        </>
      ),
    },
    {
      id: "licence",
      title: "The licence we give you",
      body: (
        <>
          <p>
            The Application is licensed to you, not sold. We give you a personal, limited, non-exclusive,
            non-transferable licence, which we can withdraw as this agreement provides, to install and use the
            Application on devices that you own or control, to use the {name} service under the{" "}
            <DocLink to="termsAndConditions" />.
          </p>
          <p>
            If you downloaded the Application from an application store, you must also use it as that store’s own
            rules allow. For the Apple App Store, that means only on Apple-branded devices that you own or control
            and as permitted by the Usage Rules in the Apple Media Services terms.
          </p>
          <p>We keep every right in the Application that this agreement does not give you.</p>
        </>
      ),
    },
    {
      id: "restrictions",
      title: "What you must not do",
      body: (
        <>
          <p>Except where the law gives you a right that cannot be removed, you must not:</p>
          <ul>
            <li>copy the Application, other than to install it and keep a backup as your device allows;</li>
            <li>sell, rent, lend, sub-license or otherwise pass the Application to anyone else;</li>
            <li>modify, translate, decompile, reverse-engineer or disassemble it, or try to derive its source code;</li>
            <li>remove or alter any copyright or trade mark notice in it;</li>
            <li>get round or interfere with its security or access controls;</li>
            <li>
              use it to build a competing product, or to copy or harvest listings and other data by automated means;
            </li>
            <li>
              use it in a way that breaks the <DocLink to="termsAndConditions" section="prohibited-use">Terms and Conditions</DocLink>{" "}
              or the law.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "accounts",
      title: "Your account",
      body: (
        <p>
          You can use one {name} account on the website and in the Application. The rules about accounts, roles,
          onboarding and verification are in the <DocLink to="termsAndConditions" section="accounts">Terms and Conditions</DocLink>.
          Keep your device and your password secure, and tell us at <Email to="support" /> if your device is lost or
          you think someone else has used your account.
        </p>
      ),
    },
    {
      id: "your-content",
      title: "Your content",
      body: (
        <p>
          Anything you send or upload through the Application, such as enquiries, appointment requests, listings,
          photos and onboarding documents, is handled exactly as if you had used the website. You keep ownership of
          it, and the licence you give us to display it is set out in the{" "}
          <DocLink to="termsAndConditions" section="intellectual-property">Terms and Conditions</DocLink>.
        </p>
      ),
    },
    {
      id: "device-permissions",
      title: "Device features and your data connection",
      body: (
        <>
          <p>
            The Application may ask for permission to use a feature of your device, such as notifications or your
            photo library when you choose to upload a file. It asks before it uses the feature, you can refuse, and
            you can change your choice in your device’s settings. Refusing may mean that part of the Application does
            not work.
          </p>
          <p>
            The Application needs an internet connection. Your mobile network or internet provider may charge you for
            the data it uses. Those charges, and keeping to your agreement with that provider and with any other
            third party whose service you use with the Application, are your responsibility.
          </p>
        </>
      ),
    },
    {
      id: "updates",
      title: "Updates and availability",
      body: (
        <p>
          We may release updates that fix faults, improve security or change features, and an update may be needed to
          keep using the Application. Updates are covered by this agreement unless they come with their own terms. We
          may change, suspend or withdraw the Application or any feature of it. We are not obliged to support an old
          version or a particular device or operating system.
        </p>
      ),
    },
    {
      id: "no-purchases",
      title: "No in-app purchases",
      body: (
        <p>
          The Application is free to download and use. It contains no in-app purchases and takes no payments. Fees
          that Professionals pay to us for subscriptions and promoted placements are invoiced and paid outside the
          Application, and money that users pay to each other never passes through it. See the{" "}
          <DocLink to="refundPolicy" />.
        </p>
      ),
    },
    {
      id: "privacy-and-account-deletion",
      title: "Privacy and deleting your account",
      body: (
        <>
          <p>
            Our <DocLink to="privacyPolicy" /> explains what personal information the Application and the website
            collect, why, who sees it and the rights you have. The Application contains no advertising and no
            third-party tracking.
          </p>
          <p>
            You can ask us to delete your account, and the personal information linked to it, by writing to{" "}
            <Email to="privacy" /> from the email address of the account. We will confirm when it has been done.
            Removing the Application from your device does not delete your account.
          </p>
        </>
      ),
    },
    {
      id: "application-stores",
      title: "Terms for applications from the Apple App Store and Google Play",
      body: (
        <>
          <p>
            This section applies if you downloaded the Application from the Apple App Store or from Google Play. In it,
            “the Store” means the one you downloaded it from, and “the Store provider” means Apple Inc. or Google LLC
            and their group companies, as the case may be.
          </p>
          <ul>
            <li>
              <strong>Who the agreement is with.</strong> This agreement is between you and {licensor} only. The Store
              provider is not a party to it. We, not the Store provider, license the Application to you and are solely
              responsible for the Application and its content.
            </li>
            <li>
              <strong>Maintenance and support.</strong> We are responsible for any maintenance and support of the
              Application that this agreement or the law requires. The Store provider has no obligation to provide
              maintenance or support for the Application.
            </li>
            <li>
              <strong>Warranty.</strong> We are responsible for any warranty that applies to the Application, to the
              extent it is not effectively disclaimed. If the Application fails to conform to an applicable warranty
              and you downloaded it from the Apple App Store, you may notify Apple, and Apple will refund the price
              you paid for the Application, if any. The Application is free, so there is no price to refund. As far
              as the law allows, the Store provider has no other warranty obligation for the Application, and any
              other claim, loss or cost that arises from a failure to conform to a warranty is our responsibility,
              subject to this agreement.
            </li>
            <li>
              <strong>Product claims.</strong> We, not the Store provider, are responsible for dealing with any claim
              you or anyone else makes about the Application or your possession or use of it. That includes product
              liability claims, a claim that the Application does not meet a legal or regulatory requirement, and
              claims under consumer protection, privacy or similar law.
            </li>
            <li>
              <strong>Intellectual property claims.</strong> If someone claims that the Application, or your
              possession and use of it, infringes their intellectual property rights, we, not the Store provider, are
              responsible for investigating, defending, settling and discharging that claim.
            </li>
            <li>
              <strong>Store terms.</strong> Your use of the Store is governed by the Store’s own terms, such as the
              Apple Media Services terms or the Google Play Terms of Service. If those terms give you rights about
              applications that are more restrictive of us than this agreement, they apply to that extent.
            </li>
            <li>
              <strong>Rights of the Store provider.</strong> Where you downloaded the Application from the Apple App
              Store, Apple and its subsidiaries are third-party beneficiaries of this agreement. Once you accept it,
              Apple has the right, and is treated as having accepted the right, to enforce this agreement against you
              as a third-party beneficiary.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "export-and-sanctions",
      title: "Export controls and sanctions",
      body: (
        <>
          <p>By using the Application you confirm that:</p>
          <ul>
            <li>
              you are not in a country that is subject to a United States Government embargo, or that the United
              States Government has designated as a “terrorist supporting” country; and
            </li>
            <li>you are not on any United States Government list of prohibited or restricted parties.</li>
          </ul>
          <p>
            You must not export or re-export the Application in breach of the export control and sanctions laws that
            apply to you.
          </p>
        </>
      ),
    },
    {
      id: "ending-the-licence",
      title: "Ending this licence",
      body: (
        <>
          <p>
            This licence lasts until it is ended. You can end it at any time by removing the Application from your
            devices. It ends automatically, without notice, if you break this agreement. We may also end it if we
            close your account under the{" "}
            <DocLink to="termsAndConditions" section="suspension-and-termination">Terms and Conditions</DocLink> or
            withdraw the Application.
          </p>
          <p>
            When the licence ends you must stop using the Application and remove it from your devices. The sections
            on restrictions, disclaimers, liability and governing law continue to apply.
          </p>
        </>
      ),
    },
    {
      id: "disclaimers-and-liability",
      title: "Disclaimers and limits on liability",
      body: (
        <>
          <p>
            We provide the Application with reasonable care and skill. Beyond that, and as far as the law allows, it
            is provided “as is” and “as available”, without any promise that it will be uninterrupted, free of errors
            or compatible with every device.
          </p>
          <p>
            Nothing in this agreement excludes or limits liability that cannot be excluded or limited by law, or
            removes a right that consumer protection law gives you. Subject to that, the limits on our liability in
            the <DocLink to="termsAndConditions" section="liability">Terms and Conditions</DocLink> apply to the
            Application as they apply to the rest of the Platform.
          </p>
          <p>
            The Application shows listings and profiles posted by other users. We are not a party to any dealing
            between users, and nothing in the Application is legal, financial or valuation advice.
          </p>
        </>
      ),
    },
    {
      id: "governing-law",
      title: "Governing law",
      body: (
        <p>
          This agreement is governed by {legal.governingLaw}, and disputes connected with it will be heard by{" "}
          {legal.courts}. If you are a consumer, this does not take away any protection or any right to bring a claim
          in your own country that the law of the place where you live gives you and does not allow to be removed by
          agreement.
        </p>
      ),
    },
    {
      id: "changes-and-contact",
      title: "Changes and how to contact us",
      body: (
        <>
          <p>
            We may change this agreement when the Application or the law changes. The date and version at the top show
            when it last changed. If a change is significant we will tell you in the Application or by email before it
            takes effect.
          </p>
          <p>
            Questions, complaints and claims about the Application should be sent to {licensor} at{" "}
            <Email to="support" />
            {legal.registeredAddress ? `, or by post to ${legal.registeredAddress}` : ""}. Legal notices go to{" "}
            <Email to="legal" />.
          </p>
        </>
      ),
    },
  ],
};
