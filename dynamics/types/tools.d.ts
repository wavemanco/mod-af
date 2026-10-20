// The inputs of the two tools this plugin registers, so `tool.call` matchers and tests
// type-check against them (the engine lays connected servers' tools, not a plugin's own).
export {}
declare module 'claude-code' {
  interface McpToolInputs {
    /** Checks a /dynamics model: `path` to its .json file, or `model` inline. */
    mcp__dynamics__check_model: {
      path?: string
      model?: object
    }
    /** Renders a checked /dynamics model to `out`, an absolute .html path. */
    mcp__dynamics__render_model: {
      path?: string
      model?: object
      out: string
    }
  }
}
