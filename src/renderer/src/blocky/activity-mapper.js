const TOOL_MAP = {
  Read: "reading_file",
  View: "reading_file",
  Write: "writing_code",
  Edit: "writing_code",
  NotebookEdit: "writing_code",
  Bash: "running_bash",
  Grep: "searching",
  Glob: "searching",
  Search: "searching",
  WebSearch: "searching",
  Agent: "thinking",
};

export function mapToolToActivity(toolName) {
  return TOOL_MAP[toolName] || "thinking";
}

export function getActivityDetail(toolName, input) {
  if (!input) return null;

  switch (toolName) {
    case "Read":
    case "View":
      return input.file_path || input.path || null;
    case "Write":
    case "Edit":
    case "NotebookEdit":
      return input.file_path || input.path || null;
    case "Bash":
      if (input.command) {
        const cmd = input.command;
        return cmd.length > 50 ? cmd.slice(0, 47) + "..." : cmd;
      }
      return null;
    case "Grep":
    case "Glob":
    case "Search":
      return input.pattern || input.query || null;
    case "Agent":
      return input.subagent_type || input.description || null;
    default:
      return null;
  }
}
