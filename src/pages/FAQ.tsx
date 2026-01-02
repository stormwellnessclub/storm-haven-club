import { Layout } from "@/components/Layout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const faqCategories = [
  {
    title: "Membership and Access",
    questions: [
      {
        question: "How does the membership application process work?",
        answer:
          "Our membership process begins with a brief application to help us understand your wellness goals. After submission, our team will review your application and contact you within 48 hours to schedule a personalized tour of our facility. During your tour, we'll discuss membership options and find the perfect plan for your lifestyle.",
      },
      {
        question: "Can I visit the center before applying for membership?",
        answer:
          "Yes! We offer day passes for $60 that give you full access to our facilities, including the fitness floor, group classes, spa amenities, and café. This is a great way to experience Storm Wellness Club before committing to membership.",
      },
    ],
  },
  {
    title: "Childcare Services",
    questions: [
      {
        question: "What childcare services do you offer?",
        answer:
          "Our Kids Care program provides supervised care for children ages 6 months to 12 years while you enjoy the club. Our trained staff engage children with age-appropriate activities, games, and educational play. Kids Care is available during club hours, and reservations can be made through your member app or at the front desk.",
      },
    ],
  },
  {
    title: "Spa and Wellness Services",
    questions: [
      {
        question: "Are spa services available to non-members?",
        answer:
          "Yes! Our Aella Spa is open to the public. Non-members can book massage therapy, body treatments, red light therapy, and cryotherapy services. Contact us to schedule an appointment or browse our spa menu for available treatments and pricing.",
      },
    ],
  },
  {
    title: "Cafe",
    questions: [
      {
        question: "Do you have dining options on-site?",
        answer:
          "Yes! Our on-site café offers a variety of healthy, nutritious options including fresh smoothies, protein shakes, grab-and-go meals, and light bites. All menu items are crafted to support your wellness journey with wholesome ingredients.",
      },
    ],
  },
  {
    title: "Facilities and Access",
    questions: [
      {
        question: "Do you offer guest passes?",
        answer:
          "We offer day passes rather than traditional guest passes. Day passes are available for $60 and provide full access to all club amenities for one day. Members can purchase day passes for their guests at the front desk.",
      },
    ],
  },
];

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};

export default function FAQ() {
  return (
    <Layout>
      {/* Header */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-primary-foreground/80 text-lg max-w-2xl mx-auto">
            Find answers to common questions about Storm Wellness Club
          </p>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6 max-w-4xl">
          {faqCategories.map((category, categoryIndex) => (
            <div key={categoryIndex} className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-6 border-b border-border pb-3">
                {category.title}
              </h2>
              <Accordion type="single" collapsible className="space-y-4">
                {category.questions.map((item, itemIndex) => (
                  <AccordionItem
                    key={itemIndex}
                    value={`${categoryIndex}-${itemIndex}`}
                    className="border border-border rounded-lg px-6 bg-card"
                  >
                    <AccordionTrigger className="text-left text-foreground hover:text-gold hover:no-underline py-5">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}

          {/* Contact Section */}
          <div className="mt-16 p-8 bg-muted rounded-lg text-center">
            <h3 className="text-xl font-semibold text-foreground mb-3">
              Still have questions?
            </h3>
            <p className="text-muted-foreground mb-6">
              Our team is here to help. Reach out to us anytime.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="tel:+13132865070"
                className="text-gold hover:text-gold-light transition-colors font-medium"
              >
                (313) 286-5070
              </a>
              <span className="hidden sm:inline text-muted-foreground">|</span>
              <a
                href="mailto:admin@stormwellnessclub.com"
                className="text-gold hover:text-gold-light transition-colors font-medium"
              >
                admin@stormwellnessclub.com
              </a>
            </div>
          </div>

          {/* Back to Top */}
          <div className="mt-12 text-center">
            <Button
              variant="outline"
              onClick={scrollToTop}
              className="gap-2"
            >
              <ArrowUp className="h-4 w-4" />
              Back to Top
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
