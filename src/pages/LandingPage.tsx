// src/pages/LandingPage.tsx
import { useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import heroImage from '../assets/images/hero-medical-hands.png';
import clinikaLogo from '../assets/images/logo-clinika.png';

// ── Types ───────────────────────────────────────────────────────────
interface ModalContentItem {
  title: string;
  color: 'blue' | 'green' | 'purple';
  icon: ReactNode;
  description: string;
  features: string[];
  benefits: string[];
}

const modalContent: Record<string, ModalContentItem> = {
  assessment: {
    title: 'Medical Assessment',
    color: 'blue',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    description: 'Our AI-powered medical assessment system provides comprehensive clinical decision support, helping healthcare professionals make informed decisions quickly and accurately.',
    features: [
      'Real-time symptom analysis with machine learning',
      'Evidence-based clinical decision support',
      'Automated risk scoring and triage',
      'Integration with medical databases',
      'Customizable assessment templates',
      'Multi-language support',
    ],
    benefits: [
      'Reduce diagnostic errors by up to 40%',
      'Save 30 minutes per patient assessment',
      'Improve patient satisfaction scores',
      'Ensure compliance with medical guidelines',
    ],
  },
  appointments: {
    title: 'Smart Appointments',
    color: 'green',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    description: "Streamline your scheduling workflow with intelligent automation, reduce no-shows, and optimize your clinic's capacity utilization.",
    features: [
      'AI-powered scheduling optimization',
      'Automated appointment reminders via SMS/Email',
      'Waitlist management system',
      'Calendar synchronization across platforms',
      'Online booking portal for patients',
      'Resource allocation optimization',
    ],
    benefits: [
      'Reduce no-shows by up to 60%',
      'Increase clinic capacity by 25%',
      'Save 2 hours daily on scheduling tasks',
      'Improve patient convenience and satisfaction',
    ],
  },
  assistant: {
    title: 'AI Assistant',
    color: 'purple',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    description: 'Your 24/7 intelligent healthcare companion that handles patient inquiries, provides clinical guidance, and supports your medical staff around the clock.',
    features: [
      '24/7 availability for patient support',
      'Natural language understanding',
      'HIPAA-compliant conversations',
      'Integration with EHR systems',
      'Multi-channel support (chat, voice, email)',
      'Continuous learning from interactions',
    ],
    benefits: [
      'Handle 80% of routine inquiries automatically',
      'Reduce staff workload significantly',
      'Provide instant responses to patients',
      'Maintain high security and privacy standards',
    ],
  },
};

const colorClasses = {
  blue:   { gradient: 'from-blue-500 to-blue-600',     bar: 'bg-blue-500',   text: 'text-blue-500',   border: 'border-blue-100 bg-blue-50/60',     badge: 'bg-blue-500',   btn: 'bg-blue-600 hover:bg-blue-700'   },
  green:  { gradient: 'from-green-500 to-green-600',   bar: 'bg-green-500',  text: 'text-green-500',  border: 'border-green-100 bg-green-50/60',   badge: 'bg-green-500',  btn: 'bg-green-600 hover:bg-green-700' },
  purple: { gradient: 'from-purple-500 to-purple-600', bar: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-100 bg-purple-50/60', badge: 'bg-purple-500', btn: 'bg-purple-600 hover:bg-purple-700'},
};

const navLinks = [
  { label: 'Features', id: 'features' },
  { label: 'About Us', id: 'about'    },
  { label: 'Contact',  id: 'contact'  },
];

// ── Main Component ──────────────────────────────────────────────────
export default function LandingPage() {
  const [activeModal, setActiveModal] = useState<keyof typeof modalContent | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Stable scroll: always reserve scrollbar space, hide the track visually
  useEffect(() => {
    const id = 'clinika-scroll-fix';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      // overflow-y:scroll keeps the scrollbar gutter reserved at ALL times → no layout shift
      // scrollbar-width:none / ::-webkit-scrollbar hides the visible track
      style.textContent = `
        html {
          overflow-y: scroll;
          scrollbar-width: none;
        }
        html::-webkit-scrollbar { display: none; width: 0; }
        body { overflow-x: hidden; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // ── Lock body scroll while modal is open (without causing width jump)
  useEffect(() => {
    if (activeModal) {
      // Use padding compensation to prevent width jump when hiding overflow
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [activeModal]);

  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      const offsetPosition = element.getBoundingClientRect().top + window.pageYOffset - 100;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white font-['Inter','system-ui',sans-serif]">

      {/* ── Navbar ──────────────────────────────────────────────── */}
      <header className="w-full bg-white/98 backdrop-blur-xl border-b border-gray-100 fixed top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <img src={clinikaLogo} alt="Clinika+" className="w-10 h-10 object-contain" />
            <span className="text-blue-700 font-extrabold text-2xl tracking-wide">
              CLINIKA<span className="text-blue-500">+</span>
            </span>
          </div>

          {/* Desktop nav — right aligned, no Sign In button */}
          <nav className="hidden md:flex items-center gap-10">
            {navLinks.map(({ label, id }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="text-gray-600 hover:text-blue-600 font-medium text-sm transition-colors duration-200 relative group"
              >
                {label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300 rounded-full" />
              </button>
            ))}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:text-blue-600 hover:bg-gray-100 transition-all"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile dropdown — nav links only, NO Sign In */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map(({ label, id }) => (
                <button
                  key={id}
                  onClick={() => scrollToSection(id)}
                  className="w-full text-left px-4 py-3 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl font-medium text-sm transition-all"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-center min-h-screen pt-20">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-black/25" />

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-6 drop-shadow-2xl">
            Intelligent Healthcare<br className="hidden sm:block" /> at Your Fingertips
          </h1>
          <p className="text-lg sm:text-xl text-white/90 mb-12 leading-relaxed drop-shadow-lg max-w-2xl mx-auto">
            Experience advanced clinical decision support with our comprehensive patient care system. From symptom assessment to appointment scheduling, we've got you covered.
          </p>
          <Link
            to="/register"
            className="group/btn relative inline-flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-10 py-4 rounded-full text-base font-bold tracking-wide overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_16px_48px_rgba(37,99,235,0.5)] hover:-translate-y-1 active:scale-95 shadow-xl shadow-blue-600/40"
          >
            <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12" />
            <span className="relative z-10">Get Started</span>
            <svg className="relative z-10 w-5 h-5 transition-transform duration-300 group-hover/btn:translate-x-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>

      {/* ── Features ────────────────────────────────────────────── */}
      <section id="features" className="py-24 md:py-32 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">

          <div className="text-center mb-16 md:mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full mb-5">
              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm font-semibold text-blue-700">Premium Features</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-5">
              Everything You Need in One Platform
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Powerful tools designed to streamline your healthcare workflow and improve patient outcomes
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">

            {/* Assessment */}
            <div className="group relative bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden hover:shadow-2xl hover:border-blue-200 transition-all duration-500 hover:-translate-y-2">
              <div className="relative h-52 overflow-hidden">
                <img src="https://thumbs.dreamstime.com/b/close-up-doctor-clipboard-hospital-door-medicine-profession-healthcare-people-concept-stethoscope-opening-78423385.jpg" alt="Medical Assessment" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute top-4 right-4 w-11 h-11 bg-white rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
              </div>
              <div className="p-7">
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">Medical Assessment</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">AI-powered symptom analysis, risk scoring, and clinical decision support — fast, accurate, and reliable.</p>
                <ul className="space-y-2 mb-7">
                  {['Real-time symptom analysis', 'Clinical decision support', 'Automated risk scoring'].map(item => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <button onClick={() => setActiveModal('assessment')} className="inline-flex items-center gap-1.5 text-blue-600 font-semibold text-sm hover:gap-3 transition-all duration-200">
                  Learn More <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
            </div>

            {/* Appointments */}
            <div className="group relative bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden hover:shadow-2xl hover:border-green-200 transition-all duration-500 hover:-translate-y-2">
              <div className="relative h-52 overflow-hidden">
                <img src="https://thumbs.dreamstime.com/b/april-desk-calendar-stethoscope-medical-appointment-schedule-to-check-up-373158987.jpg" alt="Appointments" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute top-4 right-4 w-11 h-11 bg-white rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="p-7">
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-green-600 transition-colors">Smart Appointments</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">Intelligent scheduling, automated reminders, and seamless calendar integration for efficient patient flow.</p>
                <ul className="space-y-2 mb-7">
                  {['Automated scheduling', 'Calendar synchronization', 'Waitlist management'].map(item => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <button onClick={() => setActiveModal('appointments')} className="inline-flex items-center gap-1.5 text-green-600 font-semibold text-sm hover:gap-3 transition-all duration-200">
                  Learn More <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-green-400 via-green-600 to-green-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
            </div>

            {/* AI Assistant */}
            <div className="group relative bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden hover:shadow-2xl hover:border-purple-200 transition-all duration-500 hover:-translate-y-2 sm:col-span-2 lg:col-span-1">
              <div className="relative h-52 overflow-hidden">
                <img src="https://www.shutterstock.com/shutterstock/photos/2686256315/display_1500/stock-photo-healthcare-professional-using-laptop-with-ai-chatbot-contact-us-icon-futuristic-digital-medical-2686256315.jpg" alt="AI Assistant" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute top-4 right-4 w-11 h-11 bg-white rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
              </div>
              <div className="p-7">
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-purple-600 transition-colors">AI Assistant</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">Secure, 24/7 AI-powered assistant for patient inquiries, staff support, and instant clinical guidance.</p>
                <ul className="space-y-2 mb-7">
                  {['24/7 instant support', 'Natural language processing', 'HIPAA-compliant security'].map(item => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <svg className="w-5 h-5 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <button onClick={() => setActiveModal('assistant')} className="inline-flex items-center gap-1.5 text-purple-600 font-semibold text-sm hover:gap-3 transition-all duration-200">
                  Learn More <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-purple-400 via-purple-600 to-purple-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
            </div>

          </div>
        </div>
      </section>

      {/* ── About ───────────────────────────────────────────────── */}
      <section id="about" className="py-24 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-16 md:mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-full mb-5">
              <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold text-purple-700">About Us</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-5">Transforming Healthcare Together</h2>
            <p className="text-lg text-gray-500 max-w-3xl mx-auto">
              We're on a mission to revolutionize healthcare delivery through cutting-edge technology and compassionate care
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-14 lg:gap-24 items-center">
            <div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Our Mission</h3>
              <p className="text-gray-500 leading-relaxed mb-5">
                At CLINIKA+, we believe that every patient deserves access to world-class healthcare. Our platform combines artificial intelligence, clinical expertise, and intuitive design to empower healthcare professionals and improve patient outcomes.
              </p>
              <p className="text-gray-500 leading-relaxed">
                Founded by a team of healthcare professionals and technology innovators, we understand the challenges facing modern healthcare providers. That's why we've built a comprehensive solution that addresses the real needs of clinics, hospitals, and patients alike.
              </p>
              <div className="grid grid-cols-2 gap-6 mt-10 pt-8 border-t border-gray-100">
                {[
                  { value: '10K+', label: 'Active Users',         color: 'text-blue-600'   },
                  { value: '50K+', label: 'Appointments Managed', color: 'text-green-600'  },
                  { value: '98%',  label: 'Satisfaction Rate',    color: 'text-purple-600' },
                  { value: '24/7', label: 'Support Available',    color: 'text-orange-500' },
                ].map(s => (
                  <div key={s.label}>
                    <div className={`text-3xl sm:text-4xl font-bold ${s.color} mb-1`}>{s.value}</div>
                    <div className="text-sm text-gray-500">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mt-8 md:mt-0">
              <div className="aspect-square rounded-3xl overflow-hidden shadow-2xl">
                <img src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=800" alt="Medical team" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-5 -right-5 w-40 h-40 bg-blue-600 rounded-3xl -z-10" />
              <div className="absolute -top-5 -left-5 w-28 h-28 bg-purple-600 rounded-3xl -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact ─────────────────────────────────────────────── */}
      <section id="contact" className="py-24 md:py-32 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-16 md:mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full mb-5">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              <span className="text-sm font-semibold text-green-700">Get in Touch</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-5">Ready to Get Started?</h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Join thousands of healthcare professionals who trust CLINIKA+ for their clinical needs
            </p>
          </div>

          <div className="max-w-3xl mx-auto grid sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-8 shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1.5">Email Us</h3>
              <p className="text-gray-500 text-sm mb-4">Our team is here to help you</p>
              <a href="mailto:support@clinikaplus.com" className="text-blue-600 font-semibold text-sm hover:text-blue-700 break-all transition-colors">
                support@clinikaplus.com
              </a>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1.5">Call Us</h3>
              <p className="text-gray-500 text-sm mb-4">Mon–Fri from 8am to 6pm</p>
              <a href="tel:+1234567890" className="text-green-600 font-semibold text-sm hover:text-green-700 transition-colors">
                +1 (234) 567-890
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Modal ───────────────────────────────────────────────── */}
      {activeModal && modalContent[activeModal] && (() => {
        const modal = modalContent[activeModal]!;
        const c = colorClasses[modal.color];
        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6"
            style={{ animation: 'ck-fadeIn 200ms ease both' }}
            onClick={() => setActiveModal(null)}
          >
            <style>{`
              @keyframes ck-fadeIn  { from { opacity: 0 } to { opacity: 1 } }
              @keyframes ck-slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
              @keyframes ck-zoomIn  { from { opacity: 0; transform: scale(0.96) translateY(10px) } to { opacity: 1; transform: scale(1) translateY(0) } }
            `}</style>

            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />

            <div
              className="relative bg-white w-full sm:rounded-3xl rounded-t-3xl shadow-2xl sm:max-w-2xl max-h-[92dvh] flex flex-col"
              style={{ animation: 'ck-slideUp 320ms cubic-bezier(0.32,0.72,0,1) both' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`relative px-6 sm:px-8 pt-2 pb-5 sm:pt-6 sm:pb-6 bg-gradient-to-r ${c.gradient} flex-shrink-0 rounded-t-3xl overflow-hidden`}>
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <div className="absolute top-0 right-0 w-56 h-56 bg-white rounded-full -translate-y-28 translate-x-28" />
                  <div className="absolute bottom-0 left-0 w-40 h-40 bg-white rounded-full translate-y-20 -translate-x-20" />
                </div>
                {/* drag handle */}
                <div className="sm:hidden w-8 h-1 bg-white/40 rounded-full mx-auto mt-3 mb-4" />

                <div className="relative flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white flex-shrink-0">
                      {modal.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg sm:text-2xl font-bold text-white leading-tight">{modal.title}</h3>
                      <p className="text-white/70 text-xs sm:text-sm mt-0.5">Advanced Healthcare Solution</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveModal(null)}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/20 hover:bg-white/35 text-white transition-all flex items-center justify-center hover:rotate-90 flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 sm:py-7 space-y-7 overscroll-contain">
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed">{modal.description}</p>

                <div>
                  <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className={`w-1 h-5 rounded-full ${c.bar}`} />
                    Key Features
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {modal.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                        <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${c.text}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-700 text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className={`w-1 h-5 rounded-full ${c.bar}`} />
                    Benefits
                  </h4>
                  <div className="grid gap-2.5">
                    {modal.benefits.map((benefit, i) => (
                      <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${c.border}`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${c.badge}`}>
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-gray-800 font-medium text-sm">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 px-6 sm:px-8 py-4 sm:py-5 bg-gray-50 border-t border-gray-100 rounded-b-3xl flex items-center justify-between gap-4">
                <p className="text-xs sm:text-sm text-gray-500">Ready to get started?</p>
                <Link
                  to="/register"
                  className={`px-5 py-2.5 rounded-full font-semibold text-white text-sm transition-all hover:scale-105 hover:shadow-md ${c.btn}`}
                >
                  Get Started Now
                </Link>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 py-16 mt-auto">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 grid sm:grid-cols-2 md:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-8 h-8" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="8" fill="#1e3a5f" />
                <path d="M6 20h4l3-7 4 14 4-10 2 3h11" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-white font-bold text-xl">CLINIKA+</span>
            </div>
            <p className="text-sm leading-relaxed">Modern clinical intelligence platform built for healthcare professionals.</p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-5">Navigation</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/login" className="hover:text-white transition-colors">Login</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">Sign Up</Link></li>
              <li><button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">Features</button></li>
              <li><button onClick={() => scrollToSection('about')} className="hover:text-white transition-colors">About</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-5">Legal & Compliance</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Use</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Data Protection</a></li>
              <li><a href="#" className="hover:text-white transition-colors">HIPAA Compliance</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-14 border-t border-gray-800 pt-8 text-center text-sm px-6">
          © {new Date().getFullYear()} CLINIKA+. All rights reserved. Secure, private, and built for healthcare.
        </div>
      </footer>
    </div>
  );
}
