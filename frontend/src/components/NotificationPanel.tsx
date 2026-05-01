import React from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { Notification } from '../types';
import { AlertTriangle, AlertOctagon, CheckCircle2, Info, Bell, X } from 'lucide-react';
import './NotificationPanel.css';

export const NotificationPanel: React.FC = () => {
  const notifications = useSimulationStore((state) => state.notifications);
  const markAsRead = useSimulationStore((state) => state.markNotificationAsRead);
  const removeNotification = useSimulationStore((state) => state.removeNotification);
  const clearAll = useSimulationStore((state) => state.clearNotifications);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'critical':
        return <AlertOctagon size={16} />;
      case 'warning':
        return <AlertTriangle size={16} />;
      case 'success':
        return <CheckCircle2 size={16} />;
      default:
        return <Info size={16} />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="notification-panel">
      <div className="notification-header">
        <h3>
          <Bell size={16} /> Alerts {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
        </h3>
        {notifications.length > 0 && (
          <button className="clear-btn" onClick={clearAll}>
            Clear All
          </button>
        )}
      </div>

      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="empty-state">No notifications</div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-item ${notification.type} ${!notification.read ? 'unread' : ''}`}
              onClick={() => markAsRead(notification.id)}
            >
              <div className="notification-icon">{getIcon(notification.type)}</div>
              <div className="notification-content">
                <h4>{notification.title}</h4>
                <p>{notification.message}</p>
                <span className="notification-time">
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <button
                className="close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  removeNotification(notification.id);
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
