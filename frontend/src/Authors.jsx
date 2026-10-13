import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProfileCard from './components/common/ProfileCard'
import axiosInstance from './utils/axiosInstance'
import adhithyaImage from './Images/adhithya.jpeg'
import harshiniImage from './Images/harshini.jpg'
import mvvcImage from './Images/mvvc.jpg'

const authors = [
  {
    name: 'Dr.MahaVishnu',
    title: 'Assistant Professor(Selection Grade), Department of Computer Science and Engineering',
    /*handle: 'Dr.V.C.MahaVishnu',*/
    status: 'SDC Director',
    avatarUrl: mvvcImage,
    grainUrl: '/images/Authors/grain.png',
  },

  {
    name: 'Adhithya J',
    title: 'Full-Stack Developer',
    department: '3rd CSE, Department of Computer Science and Engineering',
    contactEmail: '24z108@psgitech.ac.in',
    /*handle: 'Adhithya',*/
    phone: '8807303793',
    /*status: 'Full-Stack Engineer',*/
    avatarUrl: adhithyaImage,
    grainUrl: '/images/Authors/grain.png',
  },
  {
    name: 'Harshini Y',
    title: 'Full-Stack Developer',
    department: '3rd CSE, Department of Computer Science and Engineering',
    contactEmail: '24z158@psgitech.ac.in',
    /*handle: 'harshini',*/
    phone: '7845990817',
    /*status: 'Full-Stack Developer',*/
    avatarUrl: harshiniImage,
    grainUrl: '/images/Authors/grain.png',
  },
]

export default function Authors() {
  const navigate = useNavigate()
  const [visitorCount, setVisitorCount] = useState(null)
  const [loadingCount, setLoadingCount] = useState(true)

  useEffect(() => {
    window.scrollTo(0, 0)
    let isMounted = true

    const trackVisit = async () => {
      try {
        const hasTracked = sessionStorage.getItem('authors_visit_tracked')
        let res
        if (!hasTracked) {
          res = await axiosInstance.post('/api/visitor-count')
          sessionStorage.setItem('authors_visit_tracked', '1')
        } else {
          res = await axiosInstance.get('/api/visitor-count')
        }
        if (isMounted && res?.data?.count != null) {
          setVisitorCount(res.data.count)
        }
      } catch {
        const cached = parseInt(localStorage.getItem('cached_visitor_count') || '1', 10) + 1
        localStorage.setItem('cached_visitor_count', String(cached))
        if (isMounted) setVisitorCount(cached)
      } finally {
        if (isMounted) setLoadingCount(false)
      }
    }

    trackVisit()
    return () => { isMounted = false }
  }, [])

  const handleHeaderClick = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/')
  }

  return (
    <main className="authors-page">
      <style>{`
        .authors-page {
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
          background:
            radial-gradient(900px 450px at -10% 10%, rgba(188, 29, 29, 0.10), transparent 60%),
            radial-gradient(900px 480px at 110% 10%, rgba(14, 54, 92, 0.12), transparent 60%),
            linear-gradient(180deg, #f8fafc 0%, #ffffff 45%, #f8fafc 100%);
        }

        .authors-blob {
          position: absolute;
          border-radius: 999px;
          filter: blur(42px);
          pointer-events: none;
          z-index: 0;
          animation: floatBlob 7s ease-in-out infinite;
        }

        .blob-one {
          width: 280px;
          height: 280px;
          top: 120px;
          left: -70px;
          background: rgba(188, 29, 29, 0.12);
        }

        .blob-two {
          width: 300px;
          height: 300px;
          top: 280px;
          right: -90px;
          background: rgba(15, 23, 42, 0.12);
          animation-delay: 1.3s;
        }

        @keyframes floatBlob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-16px); }
        }

        .authors-content {
          position: relative;
          z-index: 1;
        }

        .authors-hero {
          max-width: 1200px;
          margin: 0 auto;
          text-align: center;
          padding: clamp(2.5rem, 6vh, 3.8rem) 1rem clamp(1.5rem, 3.5vh, 2.2rem);
        }

        .authors-marquee {
          letter-spacing: 0.45em;
          font-size: clamp(0.75rem, 2vw, 1.05rem);
          font-weight: 600;
          margin-bottom: 0.85rem;
          text-transform: uppercase;
          color: #475569;
        }

        .authors-heading {
          margin: 0;
          line-height: 1.05;
          color: #0f172a;
        }

        .authors-heading-top {
          font-size: clamp(2.8rem, 8vw, 5.2rem);
          font-style: italic;
          color: #bc1d1d;
          font-weight: 800;
        }

        .authors-heading-bottom {
          margin-top: 0.35rem;
          font-size: clamp(2rem, 5.8vw, 4rem);
          font-style: italic;
          color: #bc1d1d;
          font-weight: 700;
        }

        .authors-subtext {
          font-size: clamp(1.05rem, 3vw, 1.2rem);
          max-width: 760px;
          margin: 1.2rem auto 0;
          color: #334155;
          line-height: 1.8;
        }

        .authors-divider {
          height: 2px;
          width: 160px;
          background: linear-gradient(90deg, #8b4513, transparent);
          margin: 0 auto 2rem;
        }

        .authors-section {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 1rem 3rem;
        }

        .authors-kicker {
          text-align: center;
          letter-spacing: 0.35em;
          text-transform: uppercase;
          font-size: 0.75rem;
          color: #64748b;
          margin-bottom: 1.75rem;
        }

        .authors-grid {
          display: grid;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 2rem;
          justify-items: center;
          align-items: stretch;
        }

        .author-slot {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .authors-footer {
          margin-top: 1rem;
          padding: 2.5rem 1rem 3rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.85rem;
          border-top: 1px solid rgba(226, 232, 240, 0.8);
          background: rgba(248, 250, 252, 0.6);
          backdrop-filter: blur(8px);
        }

        .visitor-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.5rem 1.25rem;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 4px 14px -2px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.9);
          transition: all 0.2s ease;
        }

        .visitor-badge:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px -2px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(188, 29, 29, 0.2);
        }

        .visitor-icon-pulse {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          animation: pulseGreen 2s infinite;
        }

        @keyframes pulseGreen {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        .visitor-label {
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #64748b;
        }

        .visitor-count {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
          padding: 0.15rem 0.5rem;
          border-radius: 0.375rem;
          background: #f1f5f9;
        }

        .footer-copyright {
          font-size: 0.8rem;
          color: #94a3b8;
          font-weight: 500;
        }

        @media (min-width: 768px) {
          .authors-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 1.75rem;
          }
        }
      `}</style>

      <div className="authors-blob blob-one" />
      <div className="authors-blob blob-two" />

      <div className="authors-content">
        <Navbar onBrandClick={handleHeaderClick} brandAriaLabel="Go to previous page" />

        <section className="authors-hero">
          <p className="authors-marquee">Team SDC · Students Activity Management Software</p>

          <h1 className="authors-heading">
            <div className="authors-heading-top">The Minds</div>
            <div className="authors-heading-bottom">Shaping the Experience</div>
          </h1>

        </section>

        <div className="authors-divider" />

        <section className="authors-section">
          <p className="authors-kicker">Core Contributors</p>

          <div className="authors-grid">
            {authors.map((author) => (
              <div key={author.name} className="author-slot">
                <ProfileCard {...author} showUserInfo enableMobileTilt />
              </div>
            ))}
          </div>
        </section>

        {/* ── Visitor Counter Footer ────────────────────────────────────── */}
        <footer className="authors-footer">
          <div className="visitor-badge" title="Visitors Counter">
            <span className="visitor-icon-pulse" />
            <span className="visitor-label">Total Visitors</span>
            <span className="visitor-count">
              {loadingCount ? '...' : (visitorCount?.toLocaleString() ?? '1')}
            </span>
          </div>
          <p className="footer-copyright">
            PSG iTech · Students Activity Management Software
          </p>
        </footer>

      </div>
    </main>
  )
}

