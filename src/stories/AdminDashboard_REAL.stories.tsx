import type { Meta, StoryObj } from "@storybook/react";
import AdminDashboard from "../pages/AdminDashboard";
import { getCurrentUser, setCurrentUser, setDevMode } from "../lib/storage";

const isStorybook =
  typeof window !== "undefined" && window.location?.port === "6006";

// ✅ חשוב: זה רץ לפני render, לכן ה-guard לא יפיל אותך ל-"/"
if (isStorybook) {
  try {
    const u: any = getCurrentUser();
    if (!u || u.type !== "admin") {
      setCurrentUser({ id: "storybook-admin", type: "admin", name: "Storybook Admin" } as any);
    }
    sessionStorage.setItem("musicSystem_devMode", "true");
    setDevMode(true);
    // אם יש לך guards לפי URL:
    window.history.replaceState({}, "", "/admin/default");
  } catch {}
}

const meta: Meta = {
  title: "Pages/Admin",
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div style={{ minHeight: "100vh" }}>
      <AdminDashboard />
    </div>
  ),
};
