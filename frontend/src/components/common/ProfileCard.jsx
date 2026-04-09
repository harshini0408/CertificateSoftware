import { useRef } from 'react'

export default function ProfileCard({
  name,
  title,
  handle,
  status,
  avatarUrl,
  miniAvatarUrl,
  iconUrl,
  grainUrl,
  showUserInfo = true,
  enableMobileTilt = false,
}) {
  const cardRef = useRef(null)

  const applyTilt = (clientX, clientY) => {
    const el = cardRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top

    const px = (x / rect.width) * 2 - 1
    const py = (y / rect.height) * 2 - 1

    const rotateY = px * 7
    const rotateX = -py * 7

    el.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`
  }

  const clearTilt = () => {
    const el = cardRef.current
    if (!el) return
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)'
  }

  const onMouseMove = (e) => applyTilt(e.clientX, e.clientY)
  const onTouchMove = (e) => {
    if (!enableMobileTilt) return
    const t = e.touches?.[0]
    if (!t) return
    applyTilt(t.clientX, t.clientY)
  }

  return (
    <>
      <style>{`
        .pc-root {
          width: 100%;
          max-width: 280px;
          border-radius: 18px;
          border: 1px solid #dbe3ef;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 8px 28px rgba(15, 23, 42, 0.08);
          overflow: hidden;
          transform-style: preserve-3d;
          transition: transform 220ms ease, box-shadow 220ms ease;
          will-change: transform;
        }

        .pc-root:hover {
          box-shadow: 0 12px 34px rgba(15, 23, 42, 0.14);
        }

        .pc-head {
          position: relative;
          height: 96px;
          background:
            linear-gradient(135deg, rgba(29, 63, 114, 0.95) 0%, rgba(188, 29, 29, 0.78) 100%);
        }

        .pc-grain {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(255, 255, 255, 0.18) 0.7px, transparent 0.7px);
          background-size: 4px 4px;
          opacity: 0.45;
        }

        .pc-icon {
          position: absolute;
          right: 10px;
          top: 10px;
          width: 20px;
          height: 20px;
          opacity: 0.92;
          object-fit: contain;
        }

        .pc-avatar-wrap {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: -42px;
          border-radius: 999px;
          border: 3px solid #ffffff;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.2);
          background: #f1f5f9;
        }

        .pc-avatar {
          width: 84px;
          height: 84px;
          border-radius: 999px;
          object-fit: cover;
          display: block;
        }

        .pc-body {
          padding: 54px 14px 16px;
          text-align: center;
        }

        .pc-name {
          margin: 0;
          font-size: 1.03rem;
          font-weight: 700;
          color: #0f172a;
        }

        .pc-title {
          margin: 0.5rem 0 0;
          color: #475569;
          font-size: 0.86rem;
          line-height: 1.5;
          min-height: 44px;
        }

        .pc-row {
          margin-top: 0.78rem;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 0.45rem;
          flex-wrap: wrap;
        }

        .pc-badge {
          border-radius: 999px;
          padding: 0.25rem 0.58rem;
          font-size: 0.72rem;
          font-weight: 600;
          background: #e5edff;
          color: #1d3f72;
        }

        .pc-handle {
          border-radius: 999px;
          padding: 0.25rem 0.58rem;
          font-size: 0.72rem;
          font-weight: 600;
          background: #f1f5f9;
          color: #475569;
        }

        .pc-mini {
          width: 20px;
          height: 20px;
          border-radius: 999px;
          object-fit: cover;
          border: 1px solid #cbd5e1;
        }
      `}</style>

      <article
        ref={cardRef}
        className="pc-root"
        onMouseMove={onMouseMove}
        onMouseLeave={clearTilt}
        onTouchMove={onTouchMove}
        onTouchEnd={clearTilt}
      >
        <div className="pc-head">
          {grainUrl ? <img src={grainUrl} alt="" className="pc-grain" /> : <div className="pc-grain" />}
          {iconUrl ? <img src={iconUrl} alt="" className="pc-icon" /> : null}
          <div className="pc-avatar-wrap">
            <img
              src={avatarUrl}
              alt={name}
              className="pc-avatar"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
        </div>

        <div className="pc-body">
          <p className="pc-name">{name}</p>
          {showUserInfo ? <p className="pc-title">{title}</p> : null}

          <div className="pc-row">
            {status ? <span className="pc-badge">{status}</span> : null}
            {handle ? <span className="pc-handle">@{handle}</span> : null}
            {miniAvatarUrl ? <img src={miniAvatarUrl} alt="" className="pc-mini" /> : null}
          </div>
        </div>
      </article>
    </>
  )
}
