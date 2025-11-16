import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, HelpCircle, ChevronDown, ChevronUp, ArrowLeft, Mail, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import everbrightBg from '@/assets/everbright-bg.jpg';

const FAQ = () => {
  const [openItems, setOpenItems] = useState<string[]>([]);

  const toggleItem = (itemId: string) => {
    setOpenItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const faqCategories = [
    {
      title: "👓 Booking Appointments",
      items: [
        {
          id: "how-to-book",
          question: "How can I book an appointment?",
          answer: "Go to your customer dashboard → \"Book Appointment.\" Select your preferred date, and the system will automatically show where the optometrist is available based on their branch schedule."
        },
        {
          id: "choose-branch",
          question: "Can I choose my preferred branch?",
          answer: "You can select a date, and the system will show which branch the optometrist (Dr. Samuel Prieto) will be available on that day. The branch is auto-filled to avoid scheduling conflicts."
        },
        {
          id: "reschedule-cancel",
          question: "Can I reschedule or cancel my appointment?",
          answer: "Yes. Go to your \"Appointments\" tab → click \"Manage\" → choose \"Reschedule\" or \"Cancel.\" You can only reschedule if the appointment has not yet been confirmed by the staff."
        },
        {
          id: "appointment-confirmed",
          question: "How will I know if my appointment is confirmed?",
          answer: "Once a staff member from your selected branch confirms your booking, you will receive an in-app notification and the appointment status will change to \"Confirmed.\""
        },
        {
          id: "view-schedule",
          question: "Can I see the optometrist's schedule before booking?",
          answer: "Yes. Click \"View Doctor's Schedule\" to see Dr. Samuel's weekly rotation across the four branches. This helps you choose the right date for your preferred branch."
        }
      ]
    },
    {
      title: "💳 Payments and Receipts",
      items: [
        {
          id: "pay-online",
          question: "Do I need to pay online?",
          answer: "No. All payments are made in person at the branch after your consultation or when you pick up your reserved eyewear."
        },
        {
          id: "get-receipt",
          question: "Can I get a receipt for my payment?",
          answer: "Yes. Once your payment is processed by the branch staff, a digital receipt will automatically appear in your dashboard. You can also download it as a PDF."
        },
        {
          id: "missing-receipt",
          question: "What if my payment receipt is missing?",
          answer: "Contact the branch where your appointment took place. The staff can regenerate and re-upload your receipt to your account."
        }
      ]
    },
    {
      title: "🧾 Prescriptions and Eye Health",
      items: [
        {
          id: "view-prescription",
          question: "Where can I see my latest prescription?",
          answer: "Go to \"Vision History\" in your dashboard. It lists your past consultations, prescriptions, and progress. You can also download your prescription in PDF format."
        },
        {
          id: "prescription-details",
          question: "What does my prescription show?",
          answer: "Your prescription includes your left and right eye measurements, diagnosis, and recommended lens type. It helps track your eye progress over time."
        },
        {
          id: "track-vision-changes",
          question: "Can I track changes in my vision?",
          answer: "Yes. The Vision History includes a simple progress chart that shows improvements or changes in both eyes based on your past prescriptions."
        }
      ]
    },
    {
      title: "🕶️ Products and Eyewear Reservations",
      items: [
        {
          id: "reserve-eyewear",
          question: "Can I reserve eyewear before my check-up?",
          answer: "Yes. You can browse the product gallery of your selected branch and reserve frames or lenses. Your staff will assist you after your consultation."
        },
        {
          id: "branch-products",
          question: "Are the products the same in all branches?",
          answer: "No. Each branch has its own inventory. Make sure to check the product availability for your chosen branch before booking."
        },
        {
          id: "view-reservations",
          question: "Can I view my reserved eyewear?",
          answer: "Yes. Go to \"My Reservations\" in your dashboard to view all pending and completed reservations."
        }
      ]
    },
    {
      title: "🧠 Account and Support",
      items: [
        {
          id: "update-info",
          question: "Can I update my personal information?",
          answer: "Yes. Go to \"Profile Settings\" → edit your details. Make sure your email and contact number are updated for appointment notifications."
        },
        {
          id: "forgot-password",
          question: "What if I forgot my password?",
          answer: "Click \"Forgot Password\" on the login page, and a password reset link will be sent to your email."
        },
        {
          id: "contact-help",
          question: "Who can I contact for help?",
          answer: "You can message your assigned branch directly through the \"Contact Branch\" feature or visit the FAQ → Support section for quick answers."
        }
      ]
    },
    {
      title: "⚡ Feedback and Satisfaction",
      items: [
        {
          id: "give-feedback",
          question: "How can I give feedback about my visit?",
          answer: "After your appointment is completed, go to \"Feedback\" in your dashboard. Select your appointment and rate your experience."
        },
        {
          id: "feedback-private",
          question: "Is my feedback visible to other patients?",
          answer: "No. Feedback is sent privately to the admin for analytics to improve clinic services per branch."
        },
        {
          id: "feedback-impact",
          question: "What happens after I submit feedback?",
          answer: "Your rating contributes to the branch's satisfaction analytics, helping the clinic improve patient care and service quality."
        }
      ]
    }
  ];

  return (
    <div 
      className="min-h-screen relative"
      style={{
        backgroundImage: `url(${everbrightBg})`,
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-white/90 backdrop-blur-sm"></div>
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Eye className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-slate-900">Everbright Optical Clinic</h1>
            </div>
            <div className="flex space-x-4">
              <Button variant="outline" asChild>
                <Link to="/register">Sign Up</Link>
              </Button>
              <Button asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Back Button */}
          <div className="mb-8">
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>

          {/* FAQ Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <HelpCircle className="h-12 w-12 text-primary mr-4" />
              <h1 className="text-4xl font-bold text-slate-900">Frequently Asked Questions</h1>
            </div>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Find answers to common questions about using the Optical Management System
            </p>
          </div>

          {/* FAQ Categories */}
          <div className="space-y-8">
            {faqCategories.map((category, categoryIndex) => (
              <Card key={categoryIndex} className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-2xl text-primary">{category.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {category.items.map((item) => (
                    <Collapsible 
                      key={item.id}
                      open={openItems.includes(item.id)}
                      onOpenChange={() => toggleItem(item.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="w-full justify-between p-4 h-auto text-left"
                        >
                          <span className="font-semibold text-slate-900">{item.question}</span>
                          {openItems.includes(item.id) ? (
                            <ChevronUp className="h-5 w-5 text-slate-500" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-slate-500" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="px-4 pb-4">
                        <div className="text-slate-600 leading-relaxed">
                          {item.answer}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Contact Support Section */}
          <Card className="mt-12 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Still Need Help?</CardTitle>
              <CardDescription className="text-center">
                Can't find the answer you're looking for? Contact our friendly staff for assistance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div className="flex flex-col items-center">
                  <Mail className="h-8 w-8 text-primary mb-2" />
                  <h3 className="font-semibold mb-1">Email Support</h3>
                  <p className="text-sm text-slate-600">support@everbrightoptical.com</p>
                </div>
                <div className="flex flex-col items-center">
                  <Phone className="h-8 w-8 text-primary mb-2" />
                  <h3 className="font-semibold mb-1">Phone Support</h3>
                  <p className="text-sm text-slate-600">(555) 123-4567</p>
                </div>
                <div className="flex flex-col items-center">
                  <MapPin className="h-8 w-8 text-primary mb-2" />
                  <h3 className="font-semibold mb-1">Visit Us</h3>
                  <p className="text-sm text-slate-600">123 Main Street, City, State</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="bg-slate-900 text-white py-12 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Eye className="h-6 w-6" />
              <span className="text-xl font-bold">Everbright Optical Clinic</span>
            </div>
            <p className="text-slate-400">
              Streamlining optical clinic operations with modern technology.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default FAQ;
