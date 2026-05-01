import { AssistantMessageProps } from "@copilotkit/react-ui";
import { Markdown } from "@copilotkit/react-ui";
import { Loader } from "lucide-react";
export const CustomAssistantMessage = (props: AssistantMessageProps) => {
  const { message, isLoading, subComponent } = props;

  const hasTextContent = message?.content && message.content.trim().length > 0;

  // Only show the message box if there's actual text, or if loading without a subComponent
  const showMessageBox = hasTextContent || (isLoading && !subComponent);

  return (
    <div className={showMessageBox || subComponent ? "pb-4" : ""}>
      {showMessageBox && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            {hasTextContent && <Markdown content={message!.content!} />}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-blue-500">
                <Loader className="h-3 w-3 animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {subComponent && <div>{subComponent}</div>}
    </div>
  );
};
