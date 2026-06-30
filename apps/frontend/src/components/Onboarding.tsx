import { useState } from "react";
import "./Onboarding.css";

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [jobInput, setJobInput] = useState("");
  const [experience, setExperience] = useState<string | null>(null);

  const totalSteps = 4;
  const progressPercent = ((step + 1) / totalSteps) * 100;

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleAddJobTitle = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (jobInput.trim() && !jobTitles.includes(jobInput.trim())) {
      setJobTitles([...jobTitles, jobInput.trim()]);
      setJobInput("");
    }
  };

  const removeJobTitle = (title: string) => {
    setJobTitles(jobTitles.filter((t) => t !== title));
  };

  const experienceLevels = [
    { id: "entry", title: "Entry-level", desc: "First full-time role in the field" },
    { id: "junior", title: "Junior/Associate", desc: "Works independently on well-scoped tasks" },
    { id: "mid", title: "Mid-level", desc: "Owns projects, may mentor others" },
    { id: "senior", title: "Senior/Lead", desc: "Leads complex work and sets direction" },
    { id: "director", title: "Director", desc: "Oversees teams/functions and drives strategy" },
    { id: "exec", title: "Executive", desc: "VP/C-level leadership and org-wide decisions" },
  ];

  return (
    <div className="onboarding-layout">
      {/* Top Navigation */}
      <header className="onboarding-header">
        <div className="header-left">
          <button className="back-btn" onClick={handleBack} disabled={step === 0}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
          <span className="saved-text">Saved</span>
        </div>
        
        <div className="header-logo">
          <span className="logo-text">aiApply<span className="logo-star">✦</span></span>
        </div>
        
        <div className="header-right"></div>
      </header>

      {/* Progress Bar */}
      <div className="progress-container">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>

      {/* Main Content */}
      <main className="onboarding-main">
        {step === 0 && (
          <div className="step-content intro-step fade-in">
            <div className="hero-graphic x-graphic">
              <div className="x-shape"></div>
            </div>
            <h2>Unemployment is rough</h2>
            <p className="subtitle">
              Especially on your bank balance. But never fear! Here at aiApply, <strong>we're ready to help you get your next job!</strong>
            </p>
            <button className="primary-btn continue-btn" onClick={handleNext}>
              Continue <span>→</span>
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="step-content job-step fade-in">
            <h2>What's your desired job title?</h2>
            
            <div className="input-card">
              <div className="chips-container">
                {jobTitles.map((title) => (
                  <div key={title} className="job-chip">
                    {title}
                    <button className="remove-chip" onClick={() => removeJobTitle(title)}>×</button>
                  </div>
                ))}
                <form onSubmit={handleAddJobTitle} className="job-input-form">
                  <input
                    type="text"
                    placeholder={jobTitles.length === 0 ? "Type a job title..." : "Type to add another..."}
                    value={jobInput}
                    onChange={(e) => setJobInput(e.target.value)}
                    className="job-input"
                  />
                </form>
              </div>
              <button 
                className="add-job-btn" 
                onClick={() => handleAddJobTitle()}
                disabled={!jobInput.trim()}
              >
                + Add job title
              </button>
            </div>

            <div className="info-box">
              <svg className="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <p>Please enter clear and specific job titles (e.g., Senior Python Developer, UX/UI Designer). Avoid generic or unclear titles like Student or Developer. Specific titles help us match you with the best opportunities.</p>
            </div>

            <button 
              className="primary-btn continue-btn mt-xl" 
              onClick={handleNext}
              disabled={jobTitles.length === 0 && !jobInput.trim()}
            >
              Continue <span>→</span>
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="step-content experience-step fade-in">
            <h2>What's your target experience level in this role?</h2>
            
            <div className="experience-grid">
              {experienceLevels.map((level) => (
                <div 
                  key={level.id} 
                  className={`experience-card ${experience === level.id ? "selected" : ""}`}
                  onClick={() => {
                    setExperience(level.id);
                    // Automatically proceed to next step after a short delay for better UX
                    setTimeout(() => handleNext(), 300);
                  }}
                >
                  <h3>{level.title}</h3>
                  <p>{level.desc}</p>
                </div>
              ))}
            </div>
            {/* Fallback continue button just in case */}
            <div style={{ marginTop: "2rem", display: "flex", justifyContent: "center", opacity: experience ? 1 : 0, transition: "opacity 0.2s" }}>
                <button className="primary-btn continue-btn" onClick={handleNext} disabled={!experience}>
                  Continue <span>→</span>
                </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="step-content success-step fade-in">
            <div className="hero-graphic rocket-graphic">
              <span className="rocket-emoji">🚀</span>
              <div className="sparkles">
                <span className="sparkle s1">✦</span>
                <span className="sparkle s2">✦</span>
                <span className="sparkle s3">✦</span>
              </div>
            </div>
            <h2>Outstanding!</h2>
            <p className="subtitle">
              Your background really sets you apart! Companies will be excited to discover your unique expertise!
            </p>
            <button className="primary-btn continue-btn" onClick={() => {
                alert("Onboarding complete!");
            }}>
              Continue <span>→</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
