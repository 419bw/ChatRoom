import type { UserPresenceState } from "@chat/protocol";

import {
  getRecentActivityLabel,
  type RecentActivityByUserId,
} from "../domain/recentActivity";

type OnlineListProps = {
  users: UserPresenceState[];
  selfUserId: string | null;
  recentActivityByUserId?: RecentActivityByUserId;
};

export const OnlineList = ({
  users,
  selfUserId,
  recentActivityByUserId = {},
}: OnlineListProps) => (
  <div className="online-list">
    {users.map((user) => {
      const activityLabel = getRecentActivityLabel(recentActivityByUserId[user.userId]);

      return (
        <article key={user.userId} className="online-item">
          <div className="online-badge" data-cosmetic={user.avatar.cosmetic} />
          <div className="online-item__content">
            <div className="online-item__title">
              <strong>
                {user.nickname}
                {user.userId === selfUserId ? "（你）" : ""}
              </strong>
              {activityLabel ? (
                <span className="online-activity-chip">{activityLabel}</span>
              ) : null}
            </div>
            <span>
              坐标 {Math.round(user.position.x)} / {Math.round(user.position.y)}
            </span>
          </div>
        </article>
      );
    })}
  </div>
);
