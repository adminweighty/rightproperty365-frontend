import { DocLink, Email, type LegalContent } from "@/components/legal/legal-document";
import { legal } from "@/lib/legal";

const name = legal.tradingName;
const { requestWindowDays, responseDays, processingDays } = legal.refunds;

/** The Refund Policy. The numbers come from `legal.refunds` in `src/lib/legal.ts`. */
export const refundPolicy: LegalContent = {
  summary: [
    <>
      There is no online payment on {name}. We never take money for a property, a deposit, rent, a stay or a
      professional’s service.
    </>,
    <>
      Money you pay to an agent, owner, host, solicitor or service provider is between you and them. We do not hold it
      and cannot refund it.
    </>,
    <>
      This policy is about fees that Professionals pay to us for subscriptions and promoted placements. We refund
      duplicate and mistaken payments, and payments for a service we have not started.
    </>,
    <>
      To ask for a refund, write to <Email to="billing" /> within {requestWindowDays} days of the payment.
    </>,
  ],
  sections: [
    {
      id: "what-this-policy-covers",
      title: "What this policy covers",
      body: (
        <>
          <p>
            This policy applies to fees paid to {name} (“we”, “us”) by Professionals for paid subscriptions and
            promoted placements on the Platform, when we offer them. It forms part of our{" "}
            <DocLink to="termsAndConditions" />, and words defined there have the same meaning here.
          </p>
          <p>
            It does not apply to money that users pay to each other. The next two sections explain why, and what to do
            instead.
          </p>
        </>
      ),
    },
    {
      id: "no-online-payments",
      title: "No online payments",
      body: (
        <>
          <p>
            Neither the website nor the mobile applications take payments. There are no in-app purchases. Searching,
            sending enquiries and asking for appointments or stays is free.
          </p>
          <p>
            Fees due to us are set out on an invoice and paid outside the Platform, by bank transfer or another method
            stated on the invoice. A Platform Administrator records the payment once we have received it. Pay only
            into the account named on an invoice that we sent you. If you are unsure whether an invoice or a request
            for payment is genuine, check with <Email to="billing" /> before you pay.
          </p>
        </>
      ),
    },
    {
      id: "payments-between-users",
      title: "Money paid to another user",
      body: (
        <>
          <p>
            We are not a party to any sale, lease, tenancy, booking or service arranged through the Platform. Deposits,
            rent, purchase money, booking and short-stay payments, agency commission, legal fees and service fees are
            paid directly between the people involved. We do not collect, hold, release or refund them, and we have no
            access to that money.
          </p>
          <p>If you want money back from another user:</p>
          <ul>
            <li>ask them in writing, and keep copies of your agreement, receipts and messages;</li>
            <li>check what your agreement with them, and the law that applies to it, says about refunds and cancellation;</li>
            <li>
              if they hold a licence or belong to a professional body, such as an estate agency regulator or a law
              society, you can complain to that body;
            </li>
            <li>
              if you think you have been defrauded, report it to the police and to your bank or payment provider at
              once;
            </li>
            <li>consider taking advice from a Solicitor.</li>
          </ul>
          <p>
            Please also report the Listing or the user to <Email to="support" />. We cannot recover your money, but we
            can investigate and, where the <DocLink to="termsAndConditions" /> have been broken, remove the Listing or
            suspend the account.
          </p>
          <p>
            To protect yourself, do not pay a deposit or any other money for a property you have not seen, to a person
            whose identity and right to deal with the property you have not checked.
          </p>
        </>
      ),
    },
    {
      id: "when-we-refund",
      title: "When we refund a fee paid to us",
      body: (
        <>
          <p>We refund in full:</p>
          <ul>
            <li>
              <strong>Duplicate payments:</strong> you paid the same invoice more than once. We refund the extra
              payment.
            </li>
            <li>
              <strong>Mistaken payments:</strong> you paid more than the invoice amount, or paid us money that was not
              owed. We refund the amount that was not owed.
            </li>
            <li>
              <strong>Service not activated:</strong> we received your payment but have not activated the subscription
              or promoted placement it was for, and you tell us you no longer want it.
            </li>
            <li>
              <strong>Cancellation before activation:</strong> you cancel an order before the subscription or
              placement starts.
            </li>
            <li>
              <strong>Application not approved:</strong> you paid for a subscription for a professional role and your
              onboarding application was then refused, so the subscription could not be used.
            </li>
          </ul>
          <p>
            If we withdraw a paid subscription or placement before its period ends, for a reason other than your
            breach of the <DocLink to="termsAndConditions" />, we refund the part of the fee that covers the unused
            time.
          </p>
        </>
      ),
    },
    {
      id: "when-we-do-not-refund",
      title: "When we do not refund",
      body: (
        <>
          <p>Unless the law that applies to you requires it, we do not refund:</p>
          <ul>
            <li>
              any part of a subscription or placement period that has started, if you stop using it or change your
              mind part of the way through;
            </li>
            <li>
              a subscription or placement that produced fewer enquiries, viewings or sales than you hoped. We do not
              promise results;
            </li>
            <li>
              fees for a period during which your Listings, role or account were removed or suspended because you
              broke the <DocLink to="termsAndConditions" /> or the law;
            </li>
            <li>a request made more than {requestWindowDays} days after the payment, except for a duplicate or mistaken payment.</li>
          </ul>
          <p>
            A subscription that renews is not charged automatically, because there is no online payment. Each period
            is invoiced. If you do not want another period, do not pay the next invoice and tell us.
          </p>
        </>
      ),
    },
    {
      id: "how-to-ask",
      title: "How to ask for a refund",
      body: (
        <>
          <p>
            Write to <Email to="billing" /> within {requestWindowDays} days of the payment. A duplicate or mistaken
            payment can be reported at any time. Please include:
          </p>
          <ul>
            <li>your name, or your organisation’s name, and the email address of your account;</li>
            <li>the invoice number;</li>
            <li>the date, amount and currency of the payment, and how it was paid;</li>
            <li>proof of the payment, such as a bank confirmation;</li>
            <li>the reason for the request.</li>
          </ul>
          <p>
            We will answer within {responseDays} days. We may ask for more information to confirm the payment and who
            made it. If we refuse a request, we will say why.
          </p>
        </>
      ),
    },
    {
      id: "how-refunds-are-paid",
      title: "How and when refunds are paid",
      body: (
        <>
          <ul>
            <li>
              <strong>Method.</strong> We pay a refund by the same method, and to the same account, that the payment
              came from. We do not pay refunds in cash or to a third party. If that account has closed, we will agree
              another account in the payer’s name with you, and may ask for proof that it is yours.
            </li>
            <li>
              <strong>Timing.</strong> We pay an approved refund within {processingDays} days of approving it. Your
              bank may take further time to credit it.
            </li>
            <li>
              <strong>Currency.</strong> We refund in the currency of the original payment. We are not responsible for
              a change in exchange rates between the payment and the refund.
            </li>
            <li>
              <strong>Bank charges.</strong> We refund the amount we received. Charges made by your bank or by an
              intermediary bank on the original payment or on the refund are yours to bear, unless the refund is
              needed because of our mistake, in which case we bear the charges on the refund.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "your-legal-rights",
      title: "Your legal rights",
      body: (
        <p>
          Nothing in this policy removes a right that the law gives you and does not allow to be excluded. If the
          consumer protection law of the place where you live gives you a right to cancel or to a refund in
          circumstances this policy does not mention, you keep that right. The{" "}
          <DocLink to="termsAndConditions" section="governing-law-and-disputes">
            Terms and Conditions
          </DocLink>{" "}
          say which law governs our agreement with you and how disputes are handled.
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: (
        <p>
          We may change this policy. The date and version at the top show when it last changed. A change does not
          affect a payment made before it took effect, which stays under the policy that applied when it was made.
        </p>
      ),
    },
  ],
};
