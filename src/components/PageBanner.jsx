import React from 'react';
import { IoIosFootball } from "react-icons/io";

function PageBanner({ icon, title, subtitle, actionLabel, onAction }) {
  return (
    <section className="banner">
      <div className="banner-badge">{icon || <IoIosFootball className="icon-svg" />}</div>
      <div className="banner-text">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actionLabel && (
        <button className="pill-btn pill-btn-dark" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </section>
  );
}

export default PageBanner;
