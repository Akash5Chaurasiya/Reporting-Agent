// Mock data for the sidebar

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: number;
}

export interface ChatHistoryItem {
  id: string;
  title: string;
  timestamp: string;
  preview: string;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  notificationCount?: number;
}

// Navigation items for the sidebar
export const navItems: NavItem[] = [
  {
    id: "settings",
    label: "Settings",
    icon: "Settings",
    href: "/settings",
  },
  {
    id: "historical-reports",
    label: "Historical Reports",
    icon: "FileText",
    href: "/historical-reports",
  },
];

// Mock chat history entries
export const chatHistory: ChatHistoryItem[] = [
  {
    id: "chat-1",
    title: "Q4 Sales Analysis",
    timestamp: "2 hours ago",
    preview: "Can you show me the sales metrics for Q4?",
  },
  {
    id: "chat-2",
    title: "Customer Call Summary",
    timestamp: "Yesterday",
    preview: "Summarize the recent customer calls from last week",
  },
  {
    id: "chat-3",
    title: "Team Performance",
    timestamp: "3 days ago",
    preview: "What's the performance data for the sales team?",
  },
  {
    id: "chat-4",
    title: "Weekly Report",
    timestamp: "Last week",
    preview: "Generate a weekly report for my team",
  },
  {
    id: "chat-5",
    title: "Lead Analysis",
    timestamp: "Last week",
    preview: "Analyze the new leads from the marketing campaign",
  },
];

// Mock user profile data
export const currentUser: UserProfile = {
  name: "Nitin 123",
  email: "nitin@.io",
  avatar: "https://images.pexels.com/photos/2589653/pexels-photo-2589653.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
  notificationCount: undefined, // TODO: Enable when notifications are implemented
};
