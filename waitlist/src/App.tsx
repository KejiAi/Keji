import { useState } from 'react';
import Modal from './components/Modal';
import SlideModal from './components/SlideModal';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJollofModalOpen, setIsJollofModalOpen] = useState(false);
  const [isShawarmaModalOpen, setIsShawarmaModalOpen] = useState(false);
  const [isJoinWaitlistModalOpen, setIsJoinWaitlistModalOpen] = useState(false);

  const handleMoinmoinClick = () => {
    setIsModalOpen(true);
  };

  const handleJollofClick = () => {
    setIsJollofModalOpen(true);
  };

  const handleShawarmaClick = () => {
    setIsShawarmaModalOpen(true);
  };

  const handleJoinWaitlistClick = () => {
    // Scroll to first section first
    const firstSection = document.getElementById('first-section');
    if (firstSection) {
      firstSection.scrollIntoView({ behavior: 'smooth' });
      // Show the slide modal after scroll starts
      setTimeout(() => {
        setIsJoinWaitlistModalOpen(true);
      }, 500);
    } else {
      setIsJoinWaitlistModalOpen(true);
    }
  };

  const handleJoinWaitlistModalClose = () => {
    setIsJoinWaitlistModalOpen(false);
    // After modal closes, scroll to first section
    setTimeout(() => {
      const firstSection = document.getElementById('first-section');
      if (firstSection) {
        firstSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <div>
      {/* Desktop Message */}
      <div className="hidden md:flex fixed inset-0 bg-primary items-center justify-center p-8 z-50">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <img className="w-auto h-12 mx-auto mb-6" src="/assets/all_icons_used/logo.png" alt="Keji" />
          </div>
          <h1 className="font-heading font-bold text-white text-4xl mb-4">
            Mobile Only
          </h1>
          <p className="font-body font-medium text-white text-lg mb-6">
            This app is optimized for mobile devices. Please access it from your smartphone or tablet for the best experience.
          </p>
          <div className="text-white text-4xl">📱</div>
        </div>
      </div>

      {/* Main App - Hidden on Desktop */}
      <div className="md:hidden">
      {/* 1st section */}
      <div id="first-section" className="bg-primary w-full h-full p-8 relative overflow-y-auto">
        {/* header */}
        <div className="flex justify-between items-center">
          <img className="w-auto h-7" src="/assets/all_icons_used/logo.svg" alt="Keji" />
          <a
            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${import.meta.env.VITE_CONTACT_EMAIL || 'your-email@example.com'}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <button className="text-white px-3 py-1 border border-white rounded-xl hover:text-primary hover:bg-white transition-colors">
              Contact us
            </button>
          </a>

        </div>

        {/* hero */}
        <div className="flex justify-center items-center mt-14 mb-5">
          <h1 className="font-heading font-bold text-white text-4xl text-center">
            Wetin I fit chop with this cash?
          </h1>
        </div>

        {/* Text */}
        <p className="font-body font-medium text-[#FBF6F6] text-center text-lg ">Pick your answer to continue</p>

        {/* Floating Decorative Images */}
          <div className="absolute inset-0 pointer-events-none">
            {/* 1. left Top */}
            <img
              src="/assets/all_icons_used/emojione-monotone_hot-dog.svg"
              alt=""
              className="absolute top-[17rem] left-[5rem] h-8 w-auto"
            />

            {/* 2. right Top */}
            <img
              src="\assets\all_icons_used\uil_food.svg"
              alt=""
              className="absolute top-[17rem] right-[5rem] h-10 w-auto"
            />

            {/* 3. left Center */}
            <img
              src="/assets/all_icons_used/flowbite_bowl-food-outline.svg"
              alt=""
              className="absolute top-[23rem] left-[0rem] h-16 w-auto"
            />

            {/* 4. right Center */}
            <img
              src="/assets/all_icons_used/famicons_fast-food-outline.svg"
              alt=""
              className="absolute top-[33rem] right-[3rem] h-9 w-auto"
            />

            {/* 5. left Bottom */}
            <img
              src="/assets/all_icons_used/mdi_food-ramen.svg"
              alt=""
              className="absolute top-[40rem] left-[0rem] h-12 w-auto"
            />
          </div>

        {/* game session */}
        <div className="flex justify-center mt-12 relative z-20">

          {/* Knife */}
          <div className="mt-8">
            <img className="w-auto h-[180px] object-cover" src="/assets/all_icons_used/knife 1.png" alt="knife" />
          </div>

          {/* Plate + Money layered */}
          <div className="relative">
            {/* Plate */}
            <img
              className="w-auto h-[250px] object-cover z-10"
              src="/assets/all_icons_used/Plate 1.png"
              alt="plate"
            />

            {/* ₦200 Note */}
            <img
              className="absolute top-[20px] left-[65px] w-[130px] rotate-[1deg] z-10"
              src="/assets/all_icons_used/200 1.png"
              alt="200"
            />

            {/* ₦100 Note */}
            <img
              className="absolute top-[75px] left-[45px] w-[130px] rotate-[5deg] z-20"
              src="/assets/all_icons_used/100 1.png"
              alt="100"
            />

            {/* ₦50 Note */}
            <img
              className="absolute top-[115px] left-[110px] w-[110px] rotate-[2deg] z-30"
              src="/assets/all_icons_used/50 1.png"
              alt="50"
            />
          </div>

          {/* Fork */}
          <div className="mt-8">
            <img className="w-auto h-[180px] object-cover" src="/assets/all_icons_used/fork 1.png" alt="fork" />
          </div>

        </div>

        {/* Buttons */}
        <div className="flex flex-col items-center gap-4 my-8 font-body font-medium text-white text-4xl z-0">
          <button 
            onClick={handleJollofClick}
            className="px-4 py-4 text-black border-black rounded-3xl border-[2px] w-full max-w-[260px] hover:text-primary hover:bg-white transition-colors bg-[#FBF6F6]"
          >
            Jollof Rice
          </button>
          <button 
            onClick={handleShawarmaClick}
            className="px-4 py-4 text-black border-black rounded-3xl border-[2px] w-full max-w-[260px] hover:text-primary hover:bg-white transition-colors bg-[#FBF6F6]"
          >
            Shawarma
          </button>
          <button 
            onClick={handleMoinmoinClick}
            className="px-4 py-4 text-black border-black rounded-3xl border-[2px] w-full max-w-[260px] hover:text-primary hover:bg-white transition-colors bg-[#FBF6F6]"
          >
            Moinmoin
          </button>
        </div>

      </div>

      {/* 2nd section */}{/* 2nd section */}
      <div className="bg-white w-full h-full relative p-2 py-0">

        {/* background FULL BLEED */}
        <div
          className="w-full h-full bg-repeat"
          style={{
            backgroundImage:
              "radial-gradient(circle, transparent 0, transparent 30px, rgba(255,99,89,0.15) 30px, transparent 32px)",
            backgroundSize: "75px 75px",
          }}
        >

          {/* CONTENT WITH PADDING */}
          <div className="px-4 pt-4">
            <div className="flex flex-col gap-4">
              <p className="font-body font-bold text-black px-4 py-2 border border-black rounded-full text-xs whitespace-nowrap w-fit">
                WHAT WE'RE BUILDING
              </p>

              <p className="font-body font-medium text-black text-sm max-w-[280px] leading-relaxed">
                <strong>Keji Ai,</strong> the world's smart meal planner on budget.
                Keji helps you eat well, on any budget.
              </p>
            </div>

            <div className="flex justify-center mt-8">
              <img
                src="/assets/all_icons_used/Homescreen Mockup 1.png"
                alt="app mockup"
              />
            </div>
          </div>
        </div>
      </div>


      {/* 3rd section */}
      <div className="bg-black w-full h-full">
        <div className="flex flex-col items-center justify-center text-white text-center px-6">

          <h1 className="my-12 font-heading font-bold text-[#FBF6F6] text-3xl">
            Join the waitlist to be<br />
            one of the first users<br />
            and get:
          </h1>

          <div className="flex flex-col items-center space-y-10">

            {/* Item 1 */}
            <div className="flex flex-col items-center space-y-3">
              <img className="w-8 h-auto" src="\assets\all_icons_used\fluent_star-12-filled.svg" alt="star" />
              <p className="text-lg leading-relaxed">
                Invitation to Join our <br />
                Customer Advisory Board
              </p>
            </div>

            {/* Item 2 */}
            <div className="flex flex-col items-center space-y-3">
              <img className="w-8 h-auto" src="\assets\all_icons_used\fluent_star-12-filled.svg" alt="star" />
              <p className="text-lg leading-relaxed">
                Free 1-month premium <br />
                access when we launch
              </p>
            </div>

            {/* Item 3 */}
            <div className="flex flex-col items-center space-y-3">
              <img className="w-8 h-auto" src="\assets\all_icons_used\fluent_star-12-filled.svg" alt="star" />
              <p className="text-lg leading-relaxed">
                Access to our Exclusive <br />
                community for testers <br />
                and giveaways
              </p>
            </div>

          </div>

          <button 
            onClick={handleJoinWaitlistClick}
            className="mt-12 mb-24 bg-primary text-white py-6 px-14 rounded-[32px] text-2xl font-medium"
          >
            Join Waitlist
          </button>

          <p className="text-[#8B8B8B] mb-12 text-lg">
            ©2025   |   KejiAi   |   {' '}
            <a
              className='underline'
              href={`https://mail.google.com/mail/?view=cm&fs=1&to=${import.meta.env.VITE_CONTACT_EMAIL || 'your-email@example.com'}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Contact
            </a>
          </p>         
        </div>
      </div>

      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Slide Modals */}
      <SlideModal
        isOpen={isJollofModalOpen}
        onClose={() => setIsJollofModalOpen(false)}
        message="Wrong Choice, try again"
        duration={2000}
      />
      <SlideModal
        isOpen={isShawarmaModalOpen}
        onClose={() => setIsShawarmaModalOpen(false)}
        message="Wrong Choice, try again"
        duration={2000}
      />
      <SlideModal
        isOpen={isJoinWaitlistModalOpen}
        onClose={handleJoinWaitlistModalClose}
        message="Solve the puzzle to get access"
        duration={3000}
      />
    </div>
  );
}

export default App;
