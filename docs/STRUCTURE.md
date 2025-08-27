# Code structure: Single-file-per-node (n8n community node)

This repository follows n8n’s recommended structure for community nodes while keeping each node’s implementation in a single file.

- Node file:
  - nodes/Crossmint/CrossmintNode.node.ts
  - Contains: description/metadata, properties, execution logic, and inline helpers.
- Credentials file (required separate file in n8n):
  - credentials/CrossmintApi.credentials.ts

Organization inside the node file
- Description and properties: Node metadata and parameter definitions.
- Execute orchestration: Main execute method controlling flow and item handling.
- Inline helpers: HTTP requests, mapping, and validation kept local to the file.
- Errors/logging: Standard n8n error types and redaction for safety.
- Output mapping: Consistent, well-defined response shapes.

Notes
- No behavior is changed by this structure; it only reflects how code is organized.
- Additional nodes, if added in the future, should each live in their own single .node.ts file.
- Custom credentials must remain in credentials/*.credentials.ts as per n8n requirements.

References
- n8n node file structure: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-file-structure/
- Code node constraints and conventions: https://docs.n8n.io/code/code-node/
