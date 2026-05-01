import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <SettingsIcon className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          <p className="text-muted-foreground">
            Settings configuration will be implemented here. This page will allow users to:
          </p>
          <ul className="mt-4 space-y-2 text-muted-foreground">
            <li>• Configure API keys and connections</li>
            <li>• Set up notification preferences</li>
            <li>• Manage user preferences</li>
            <li>• Configure agent behavior</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
