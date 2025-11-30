import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Users, Calendar, BarChart3, ArrowRight, HelpCircle, ShoppingBag, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PublicProductGallery from '@/components/public/PublicProductGallery';
import everbrightBg from '@/assets/everbright-bg.jpg';

const Index = () => {
  const [showFloatingButton, setShowFloatingButton] = useState(true); // Always visible for attention
  const [isScrolling, setIsScrolling] = useState(false);

  // Hide button when user is already at product gallery section
  useEffect(() => {
    const handleScroll = () => {
      const gallerySection = document.getElementById('product-gallery-section');
      if (gallerySection) {
        const galleryTop = gallerySection.offsetTop;
        const galleryBottom = galleryTop + gallerySection.offsetHeight;
        const scrollPosition = window.scrollY + window.innerHeight / 2;
        
        // Hide button if user is viewing the product gallery section
        const isAtGallery = scrollPosition >= galleryTop - 200 && scrollPosition <= galleryBottom + 200;
        setShowFloatingButton(!isAtGallery);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const scrollToProductGallery = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent multiple clicks
    if (isScrolling) {
      return;
    }
    
    setIsScrolling(true);
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      // Find the product gallery section by ID (most reliable)
      let targetElement = document.getElementById('product-gallery-section');
      
      // Fallback: Try to find by heading text
      if (!targetElement) {
        const headings = Array.from(document.querySelectorAll('h2'));
        const productHeading = headings.find(h => h.textContent?.includes('Product Gallery') || h.textContent?.includes('Our Product Gallery'));
        if (productHeading) {
          targetElement = productHeading.closest('section') as HTMLElement;
        }
      }
      
      if (targetElement) {
        // Find the h2 title element for precise positioning
        const h2Element = targetElement.querySelector('h2');
        
        // Use the h2 element if found, otherwise use the section
        const scrollTarget = h2Element || targetElement;
        
        // Calculate optimal scroll position
        const elementRect = scrollTarget.getBoundingClientRect();
        const absoluteElementTop = elementRect.top + window.pageYOffset;
        
        // Calculate offset to position gallery nicely in viewport
        // This ensures the title and description are fully visible
        // Account for navbar/header (typically 60-80px) + extra breathing room
        const headerOffset = 120; // Optimal spacing to show gallery header nicely
        
        // Calculate scroll position
        const scrollPosition = Math.max(0, absoluteElementTop - headerOffset);
        
        // Smooth scroll to position gallery perfectly
        window.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
      }
      
      // Reset scrolling state
      setTimeout(() => {
        setIsScrolling(false);
      }, 2000);
    }, 50);
  };

  const roleCards = [
    {
      title: 'Customers',
      description: 'Book appointments, view vision history, and manage prescriptions',
      icon: Eye,
      color: 'customer',
      path: '/login',
      features: ['Book Appointments', 'Vision History', 'Digital Prescriptions', 'Receipt Downloads']
    },
    {
      title: 'Optometrists',
      description: 'Manage patient care, prescriptions, and daily appointments',
      icon: Users,
      color: 'optometrist',
      path: '/login',
      features: ['Patient Records', 'Prescription Management', 'Daily Schedule', 'Medical History']
    },
    {
      title: 'Clinic Staff',
      description: 'Handle inventory, appointments, and patient communications',
      icon: Calendar,
      color: 'staff',
      path: '/login',
      features: ['Inventory Management', 'Appointment Scheduling', 'Patient Notifications', 'Sales Tracking']
    },
    {
      title: 'Administrators',
      description: 'Comprehensive system management and analytics overview',
      icon: BarChart3,
      color: 'admin',
      path: '/login',
      features: ['Multi-branch Analytics', 'User Management', 'System Configuration', 'Performance Reports']
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
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm"></div>
      
      {/* Content */}
      <div className="relative z-10">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex items-center justify-center sm:justify-start space-x-2">
            <Eye className="h-8 w-8 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 text-center sm:text-left">
              Everbright Optical Clinic
            </h1>
          </div>
          <div className="flex flex-wrap justify-center sm:justify-end gap-2 sm:space-x-4">
            <Button variant="outline" asChild>
              <Link to="/faq">
                <HelpCircle className="h-4 w-4 mr-2" />
                FAQ
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/register">Sign Up</Link>
            </Button>
            <Button asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6">
          Everbright Optical Clinic
          <span className="block text-primary">Management System</span>
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
         
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" asChild>
            <Link to="/register">
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/login">Sign In to Existing Account</Link>
          </Button>
        </div>
      </section>


      {/* Role-based Access Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Designed for Every Role
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Our platform provides specialized dashboards and features tailored to each user type in your optical clinic.
          </p>
        </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {roleCards.map((role, index) => (
            <Card key={index} className="shadow-lg border-0 hover:shadow-xl transition-all duration-300 group">
              <CardHeader className="text-center">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 ${
                  role.color === 'customer' ? 'bg-customer' :
                  role.color === 'optometrist' ? 'bg-optometrist' :
                  role.color === 'staff' ? 'bg-staff' :
                  'bg-admin'
                }`}>
                  <role.icon className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl font-bold">{role.title}</CardTitle>
                <CardDescription className="text-sm">
                  {role.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {role.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-sm text-slate-600">
                      <div className="w-2 h-2 bg-slate-300 rounded-full mr-3" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button 
                  className="w-full" 
                  variant={role.color as any}
                  asChild
                >
                  <Link to={role.path}>
                    Access Dashboard
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Product Gallery Section */}
      <PublicProductGallery />

      {/* Floating Scroll to Products Button */}
      {showFloatingButton && (
        <button
          onClick={scrollToProductGallery}
          disabled={isScrolling}
          className="fixed bottom-8 right-8 z-[100] group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full pointer-events-auto"
          aria-label="Scroll to product gallery"
          type="button"
          style={{ pointerEvents: isScrolling ? 'none' : 'auto' }}
        >
          <div className="relative">
            {/* Multiple pulsing rings for attention - Enhanced Blue, Yellow, White */}
            <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-70" style={{ animationDuration: '2s' }}></div>
            <div className="absolute inset-0 bg-yellow-400 rounded-full animate-ping opacity-60" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}></div>
            <div className="absolute inset-0 bg-white rounded-full animate-pulse opacity-50"></div>
            <div className="absolute inset-0 bg-blue-400 rounded-full animate-pulse opacity-40" style={{ animationDuration: '1.5s', animationDelay: '1s' }}></div>
            
            {/* Enhanced Glow effects - Multiple layers for depth */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-yellow-400 to-blue-500 rounded-full blur-2xl opacity-70 animate-pulse" style={{ animationDuration: '2s' }}></div>
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-300 via-white to-blue-400 rounded-full blur-xl opacity-50 animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '0.3s' }}></div>
            
            {/* Main button - Enhanced vibrant Blue, Yellow, White gradient */}
            <div 
              className="relative bg-gradient-to-br from-blue-600 via-yellow-400 via-blue-500 to-yellow-300 rounded-full p-6 shadow-2xl transform transition-all duration-300 hover:scale-110 hover:shadow-blue-500/80 active:scale-95 border-3 border-white"
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #facc15 25%, #3b82f6 50%, #facc15 75%, #2563eb 100%)',
                boxShadow: '0 0 30px rgba(37, 99, 235, 0.8), 0 0 60px rgba(250, 204, 21, 0.6), 0 0 90px rgba(255, 255, 255, 0.5), 0 10px 40px rgba(0, 0, 0, 0.3)',
                borderWidth: '3px'
              }}
            >
              {/* Inner shine effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/30 via-transparent to-transparent rounded-full"></div>
              
              <div className="flex flex-col items-center justify-center text-white drop-shadow-2xl relative z-10">
                <ShoppingBag className="w-8 h-8 mb-2 animate-bounce" style={{ animationDuration: '1.5s', filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))' }} />
                <ChevronDown className="w-6 h-6 animate-pulse" style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' }} />
              </div>
            </div>
            
            {/* Tooltip */}
            <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
              <div className="bg-gray-900 text-white text-sm font-bold px-4 py-2.5 rounded-lg shadow-2xl whitespace-nowrap border border-gray-700">
                <span className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  View Products
                </span>
                <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900"></div>
              </div>
            </div>
          </div>
          
          <style>{`
            @keyframes float {
              0%, 100% { transform: translateY(0px) rotate(0deg); }
              25% { transform: translateY(-10px) rotate(-3deg); }
              50% { transform: translateY(-15px) rotate(0deg); }
              75% { transform: translateY(-10px) rotate(3deg); }
            }
            @keyframes glow {
              0%, 100% { 
                box-shadow: 0 0 30px rgba(37, 99, 235, 0.8), 0 0 60px rgba(250, 204, 21, 0.6), 0 0 90px rgba(255, 255, 255, 0.5), 0 10px 40px rgba(0, 0, 0, 0.3);
              }
              50% { 
                box-shadow: 0 0 40px rgba(37, 99, 235, 1), 0 0 80px rgba(250, 204, 21, 0.8), 0 0 120px rgba(255, 255, 255, 0.7), 0 15px 50px rgba(0, 0, 0, 0.4);
              }
            }
            @keyframes shimmer {
              0% { background-position: -200% center; }
              100% { background-position: 200% center; }
            }
            .group:hover .animate-bounce {
              animation: float 2s ease-in-out infinite;
            }
            .group:not(:disabled) > div > div:last-child {
              animation: glow 2s ease-in-out infinite;
            }
            .group:not(:disabled) > div > div:last-child > div:first-child {
              background-size: 200% 200%;
              animation: shimmer 3s linear infinite;
            }
          `}</style>
        </button>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Eye className="h-6 w-6" />
            <span className="text-xl font-bold">Optical Clinic Management</span>
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

export default Index;
