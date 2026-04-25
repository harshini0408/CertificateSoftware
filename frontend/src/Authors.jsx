import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProfileCard from './components/common/ProfileCard'

const authors = [
  {
    name: 'Dr.MahaVishnu',
    title: 'Website Coordinator and Assistant Professor(Selection Grade), CSE',
    handle: 'Dr.V.C.MahaVishnu',
    status: 'Website Coordinator',
    avatarUrl: '/images/Authors/mvvc.png',
    grainUrl: '/images/Authors/grain.png',
  },

  {
    name: 'Adhithya J',
    title: ' Full-Stack Developer',
    contactEmail: '24z108@psgitech.ac.in',
    handle: 'Adhithya',
    phone: '8807303793',
    status: 'Full-Stack Engineer',
    avatarUrl: '/images/Authors/arya.png',
    grainUrl: '/images/Authors/grain.png',
  },
  {
    name: 'Harshini Y',
    title: 'Full-Stack Developer',
    contactEmail: '24z158@psgitech.ac.in',
    handle: 'harshini',
    phone: '7845990817',
    status: 'Full-Stack Developer',
    avatarUrl: '/images/Authors/abi.png',
    grainUrl: '/images/Authors/grain.png',
  },
]

export default function Authors() {
  const navigate = useNavigate()
  const [leadAuthor, ...teamAuthors] = authors

  useEffect(() => {
    window.scrollTo(0, 0)
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
          padding: clamp(4rem, 10vh, 6rem) 1rem clamp(3rem, 8vh, 5rem);
        }

        .authors-marquee {
          letter-spacing: 0.45em;
          font-size: clamp(0.75rem, 2vw, 1.05rem);
          font-weight: 600;
          margin-bottom: 1.1rem;
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
          margin-top: 0.45rem;
          font-size: clamp(2rem, 5.8vw, 4rem);
          font-style: italic;
          color: #bc1d1d;
          font-weight: 700;
        }

        .authors-subtext {
          font-size: clamp(1.05rem, 3vw, 1.2rem);
          max-width: 760px;
          margin: 1.6rem auto 0;
          color: #334155;
          line-height: 1.9;
        }

        .authors-divider {
          height: 2px;
          width: 160px;
          background: linear-gradient(90deg, #8b4513, transparent);
          margin: 0 auto 4rem;
        }

        .authors-section {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1rem 6rem;
        }

        .authors-kicker {
          text-align: center;
          letter-spacing: 0.35em;
          text-transform: uppercase;
          font-size: 0.75rem;
          color: #64748b;
          margin-bottom: 2.75rem;
        }

        .authors-grid {
          display: grid;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 1.5rem;
        }

        .authors-top {
          display: flex;
          justify-content: center;
          margin-bottom: 1.75rem;
        }

        .authors-grid-bottom {
          display: grid;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 1.5rem;
          justify-items: center;
        }

        .author-slot {
          display: flex;
          justify-content: center;
        }

        .authors-outro {
          max-width: 900px;
          margin: 0 auto;
          text-align: center;
          padding: 0 1rem 4.5rem;
          color: #475569;
          line-height: 1.9;
          font-size: 1.1rem;
        }

        @media (min-width: 768px) {
          .authors-grid-bottom {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (min-width: 1024px) {
          .authors-grid-bottom {
            max-width: 760px;
            margin: 0 auto;
          }
        }
      `}</style>

      <div className="authors-blob blob-one" />
      <div className="authors-blob blob-two" />

      <div className="authors-content">
        <Navbar onBrandClick={handleHeaderClick} brandAriaLabel="Go to previous page" />

        <section className="authors-hero">
          <p className="authors-marquee">Team SDC · Credit Points Management System</p>

          <h1 className="authors-heading">
            <div className="authors-heading-top">The Minds</div>
            <div className="authors-heading-bottom">Shaping the Experience</div>
          </h1>

        </section>

        <div className="authors-divider" />

        <section className="authors-section">
          <p className="authors-kicker">Core Contributors</p>

          <div className="authors-grid">
            <div className="authors-top">
              <div className="author-slot">
                <ProfileCard {...leadAuthor} showUserInfo enableMobileTilt />
              </div>
            </div>

            <div className="authors-grid-bottom">
              {teamAuthors.map((author) => (
                <div key={author.name} className="author-slot">
                  <ProfileCard {...author} showUserInfo enableMobileTilt />
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </main>
  )
}
