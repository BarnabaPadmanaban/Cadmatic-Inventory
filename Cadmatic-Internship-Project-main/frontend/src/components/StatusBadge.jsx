import React from 'react';
import { getStatusInfo } from '../utils/statusUtils';

export default function StatusBadge({ code, name }) {
  const info = getStatusInfo(code);
  return (
    <span
      className="status-badge"
      style={{ backgroundColor: info.bg, color: info.text, border: `1px solid ${info.color}33` }}
    >
      {name || info.name}
    </span>
  );
}
