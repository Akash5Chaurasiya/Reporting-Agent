import { FileText, Calendar, Download } from "lucide-react";

export default function HistoricalReportsPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <FileText className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Historical Reports</h1>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Date Range</h2>
          </div>
          <p className="text-muted-foreground mb-4">
            Select a date range to view historical reports.
          </p>
          <div className="flex gap-4">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
              Last 7 Days
            </button>
            <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors">
              Last 30 Days
            </button>
            <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors">
              Custom Range
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Available Reports</h2>
          <p className="text-muted-foreground">
            Historical reports will be displayed here. Features to implement:
          </p>
          <ul className="mt-4 space-y-2 text-muted-foreground">
            <li>• Call volume analytics</li>
            <li>• Agent performance metrics</li>
            <li>• Customer satisfaction trends</li>
            <li>• Response time analysis</li>
          </ul>

          <div className="mt-6 pt-6 border-t border-border">
            <button className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground transition-colors">
              <Download className="w-4 h-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
