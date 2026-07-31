import React from 'react';

const TOKENS = ['{first_name}', '{team_name}', '{match_date}', '{roster_link}'];

function NotifyPlayers({
  teams,
  playerCount,
  deliveryMethods,
  onToggleDeliveryMethod,
  message,
  onMessageChange,
  teamToggles,
  onToggleTeam,
  onBack,
  onSend,
}) {
  const insertToken = (token) => onMessageChange(`${message}${message.endsWith(' ') || message.length === 0 ? '' : ' '}${token}`);

  const firstEnabledTeam = teams.find((t) => teamToggles[t.id]) || teams[0];
  const previewPlayer = firstEnabledTeam?.players[0];
  const rosterSlug = firstEnabledTeam
    ? firstEnabledTeam.name.replace('Team ', '').toLowerCase()
    : '';
  const previewText = message
    .replace('{first_name}', previewPlayer?.name.split(' ')[0] || 'Player')
    .replace('{team_name}', firstEnabledTeam?.name || 'Team')
    .replace(
      '{roster_link}',
      `boeingindoorsoccer.com/teams/${rosterSlug}`
    );

  return (
    <div className="panel notify-panel">
      <div className="notify-breadcrumb">
        <button className="link-btn" onClick={onBack}>
          &lt; Back
        </button>
        <span className="notify-breadcrumb-title">Notify Players</span>
        <span className="generated-subtitle">
          Monday Night League · Winter 2026 · {playerCount} players across{' '}
          {teams.length} teams
        </span>
        <button className="pill-btn pill-btn-blue notify-send-btn" onClick={onSend}>
          Send Notifications →
        </button>
      </div>

      <div className="notify-grid">
        <div className="notify-main">
          <span className="option-label">Delivery Method</span>
          <div className="delivery-method-row">
            <button
              className={`delivery-card ${deliveryMethods.email ? 'active' : ''}`}
              onClick={() => onToggleDeliveryMethod('email')}
            >
              <span className="delivery-card-title">Email</span>
              <span className="delivery-card-sub">All {playerCount} players</span>
            </button>
            <button
              className={`delivery-card ${deliveryMethods.sms ? 'active' : ''}`}
              onClick={() => onToggleDeliveryMethod('sms')}
            >
              <span className="delivery-card-title">SMS</span>
              <span className="delivery-card-sub">
                {teams.reduce((sum, t) => sum + t.players.filter((p) => p.hasPhone).length, 0)}{' '}
                with numbers
              </span>
            </button>
            <button
              className={`delivery-card ${deliveryMethods.app ? 'active' : ''}`}
              onClick={() => onToggleDeliveryMethod('app')}
            >
              <span className="delivery-card-title">App Push</span>
              <span className="delivery-card-sub">
                {teams.reduce((sum, t) => sum + t.players.filter((p) => p.hasApp).length, 0)}{' '}
                with app
              </span>
            </button>
          </div>

          <span className="option-label">Message</span>
          <textarea
            className="message-textarea"
            value={message}
            maxLength={320}
            onChange={(e) => onMessageChange(e.target.value)}
          />
          <div className="message-footer">
            <div className="token-buttons">
              {TOKENS.map((token) => (
                <button
                  key={token}
                  className="token-btn"
                  onClick={() => insertToken(token)}
                >
                  {token}
                </button>
              ))}
            </div>
            <span className="char-count">{message.length} / 320 chars</span>
          </div>
        </div>

        <div className="notify-sidebar">
          <div className="panel sidebar-card">
            <span className="option-label">Send To</span>
            {teams.map((team) => (
              <label className="send-to-row" key={team.id}>
                <span className="team-dot" style={{ background: team.color }} />
                <span className="send-to-name">{team.name}</span>
                <span className="send-to-count">{team.players.length} players</span>
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={!!teamToggles[team.id]}
                  onChange={() => onToggleTeam(team.id)}
                />
              </label>
            ))}
          </div>

          <div className="panel sidebar-card">
            <span className="option-label">Preview</span>
            <div className="preview-box">
              <p className="preview-from">
                From: Boeing Indoor Soccer League
                <br />
                &lt;noreply@boeingindoorsoccer.com&gt;
              </p>
              <p className="preview-body">{previewText}</p>
              <p className="preview-link">
                View roster →<br />
                boeingindoorsoccer.com/teams/{rosterSlug}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotifyPlayers;
