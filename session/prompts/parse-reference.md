# Intelligent Reference File Analysis

You are analyzing a reference file to extract structured planning information.

## Input

You receive:
- **File path**: The reference file path
- **File content**: The raw content of the file
- **File extension**: Detected from path

## Task

Analyze the reference file intelligently based on its TYPE and CONTENT. Return structured data that can be integrated into a plan.

## File Type Detection & Analysis

### 1. OpenAPI/Swagger Specifications (`.json`, `.yaml`, `.yml`)

**Detection signals:**
- Contains `openapi` or `swagger` key
- Has `paths`, `components`, `schemas` keys
- Version string like "3.0.0" or "2.0"

**Extract:**
```json
{
  "reference_type": "openapi",
  "detected_as": "OpenAPI 3.0 Specification",
  "api_endpoints": [
    {
      "method": "GET|POST|PUT|DELETE|PATCH",
      "path": "/api/products",
      "operationId": "getProducts",
      "summary": "List all products",
      "parameters": ["query: limit", "query: offset"],
      "request_body": "ProductCreateRequest",
      "response": "ProductListResponse"
    }
  ],
  "data_models": [
    {
      "name": "Product",
      "fields": [
        {"name": "id", "type": "string", "required": true},
        {"name": "name", "type": "string", "required": true},
        {"name": "price", "type": "number", "required": false}
      ]
    }
  ],
  "plan_suggestions": {
    "api_phase": ["Implement GET /api/products", "Implement POST /api/products"],
    "database_phase": ["Create Product model with id, name, price fields"],
    "validation_phase": ["Add request validation for ProductCreateRequest schema"]
  }
}
```

### 2. Existing Plan Files (`requirements.json`, `orchestration.json`)

**Detection signals:**
- Contains `plan_name`, `requirements`, `phases` keys
- Has `plan_type: "conceptual"` or `plan_type: "executable"`

**Extract:**
```json
{
  "reference_type": "existing_plan",
  "detected_as": "Conceptual Plan" | "Executable Plan",
  "plan_name": "original-plan-name",
  "original_goal": "What the plan was trying to achieve",
  "requirements": [
    {
      "id": "req-1",
      "description": "Original requirement",
      "relevance": "high|medium|low|none",
      "relevance_reason": "Why this is/isn't relevant to current conversation"
    }
  ],
  "phases": [
    {
      "phase_name": "Database",
      "tasks": ["Task 1", "Task 2"],
      "relevance": "high|medium|low|none"
    }
  ],
  "decisions_to_preserve": [
    {"decision": "...", "rationale": "..."}
  ],
  "plan_suggestions": {
    "inherit_requirements": ["req-1", "req-3"],
    "skip_requirements": ["req-2 - no longer relevant because..."],
    "inherit_phases": ["Database", "API"],
    "architectural_context": "Key decisions from previous plan to preserve"
  }
}
```

### 3. SQL Schema Files (`.sql`)

**Detection signals:**
- Contains `CREATE TABLE`, `ALTER TABLE`
- Has SQL DDL statements

**Extract:**
```json
{
  "reference_type": "sql_schema",
  "detected_as": "PostgreSQL DDL" | "MySQL DDL" | "Generic SQL",
  "tables": [
    {
      "name": "products",
      "columns": [
        {"name": "id", "type": "UUID", "constraints": ["PRIMARY KEY", "DEFAULT gen_random_uuid()"]},
        {"name": "name", "type": "VARCHAR(255)", "constraints": ["NOT NULL"]},
        {"name": "created_at", "type": "TIMESTAMP", "constraints": ["DEFAULT NOW()"]}
      ],
      "indexes": ["idx_products_name"],
      "foreign_keys": [{"column": "category_id", "references": "categories(id)"}]
    }
  ],
  "relationships": [
    {"from": "products.category_id", "to": "categories.id", "type": "many-to-one"}
  ],
  "plan_suggestions": {
    "database_phase": ["Schema already defined - use existing tables", "Add migrations for any modifications"],
    "api_phase": ["CRUD endpoints for: products, categories"],
    "validation_phase": ["Enforce NOT NULL constraints", "Validate foreign key references"]
  }
}
```

### 4. Prisma Schema Files (`.prisma`)

**Detection signals:**
- Contains `model`, `datasource`, `generator` keywords
- Prisma-specific syntax

**Extract:**
```json
{
  "reference_type": "prisma_schema",
  "detected_as": "Prisma Schema",
  "models": [
    {
      "name": "Product",
      "fields": [
        {"name": "id", "type": "String", "attributes": ["@id", "@default(cuid())"]},
        {"name": "name", "type": "String"},
        {"name": "category", "type": "Category", "relation": "many-to-one"}
      ]
    }
  ],
  "enums": [
    {"name": "Status", "values": ["DRAFT", "PUBLISHED", "ARCHIVED"]}
  ],
  "plan_suggestions": {
    "database_phase": ["Models defined in Prisma - generate client", "Add any new fields via migration"],
    "api_phase": ["Use Prisma client for CRUD operations"],
    "type_safety": ["Types auto-generated from Prisma schema"]
  }
}
```

### 5. GraphQL Schema Files (`.graphql`, `.gql`)

**Detection signals:**
- Contains `type`, `query`, `mutation`, `subscription` keywords
- GraphQL SDL syntax

**Extract:**
```json
{
  "reference_type": "graphql_schema",
  "detected_as": "GraphQL SDL",
  "types": [
    {
      "name": "Product",
      "kind": "type",
      "fields": [
        {"name": "id", "type": "ID!"},
        {"name": "name", "type": "String!"}
      ]
    }
  ],
  "queries": [
    {"name": "products", "args": ["limit: Int", "offset: Int"], "returns": "[Product!]!"}
  ],
  "mutations": [
    {"name": "createProduct", "args": ["input: ProductInput!"], "returns": "Product!"}
  ],
  "plan_suggestions": {
    "api_phase": ["Implement resolvers for: products, createProduct"],
    "database_phase": ["Ensure backing store matches GraphQL types"],
    "validation_phase": ["GraphQL handles type validation - add business rules"]
  }
}
```

### 6. Design Images (`.png`, `.jpg`, `.jpeg`, `.svg`, `.figma`)

**Detection signals:**
- Image file extension
- Binary content or SVG markup

**For images Claude can analyze:**
```json
{
  "reference_type": "design_mockup",
  "detected_as": "UI Mockup" | "Wireframe" | "Component Design",
  "ui_elements": [
    {"type": "header", "description": "Navigation bar with logo and menu"},
    {"type": "form", "description": "Product creation form with name, price, description fields"},
    {"type": "table", "description": "Product list with columns: name, price, status, actions"},
    {"type": "button", "description": "Primary CTA 'Add Product'"}
  ],
  "layout_patterns": [
    {"pattern": "sidebar-main", "description": "Left sidebar navigation, main content area"},
    {"pattern": "card-grid", "description": "Products displayed in responsive card grid"}
  ],
  "interactions": [
    {"element": "Add Product button", "action": "Opens modal form"},
    {"element": "Table row", "action": "Click to view product details"}
  ],
  "plan_suggestions": {
    "ui_phase": ["Create Header component", "Create ProductForm component", "Create ProductTable component"],
    "ux_requirements": ["Modal for product creation", "Responsive grid layout"],
    "state_management": ["Product list state", "Form state", "Modal open/close state"]
  }
}
```

### 7. Markdown Documentation (`.md`)

**Detection signals:**
- Markdown syntax (headers, lists, code blocks)
- README, SPEC, DESIGN in filename

**Extract:**
```json
{
  "reference_type": "documentation",
  "detected_as": "Requirements Doc" | "Design Doc" | "README" | "Specification",
  "sections": [
    {"header": "Overview", "content_summary": "..."},
    {"header": "Requirements", "items": ["Req 1", "Req 2"]},
    {"header": "Architecture", "content_summary": "..."}
  ],
  "extracted_requirements": [
    {"description": "Requirement from doc", "source_section": "Requirements"}
  ],
  "technical_decisions": [
    {"decision": "...", "source_section": "Architecture"}
  ],
  "plan_suggestions": {
    "requirements_to_add": ["Requirement 1", "Requirement 2"],
    "decisions_to_preserve": ["Use PostgreSQL", "REST API"],
    "context_notes": "Key context from documentation"
  }
}
```

### 8. TypeScript/JavaScript Files (`.ts`, `.js`, `.tsx`, `.jsx`)

**Detection signals:**
- Code syntax
- Imports, exports, class/function definitions

**Extract:**
```json
{
  "reference_type": "source_code",
  "detected_as": "TypeScript Module" | "React Component" | "API Handler",
  "exports": [
    {"name": "ProductService", "type": "class", "methods": ["create", "findAll", "update"]},
    {"name": "ProductSchema", "type": "const", "purpose": "Zod validation schema"}
  ],
  "patterns_used": [
    {"pattern": "Repository pattern", "location": "ProductService class"},
    {"pattern": "Dependency injection", "location": "constructor"}
  ],
  "interfaces": [
    {"name": "Product", "fields": ["id", "name", "price"]}
  ],
  "plan_suggestions": {
    "follow_patterns": ["Use repository pattern like ProductService", "Follow existing DI approach"],
    "extend_existing": ["Add new methods to ProductService if extending product functionality"],
    "type_definitions": ["Reuse Product interface"]
  }
}
```

### 9. JSON Configuration/Data (`.json`)

**Detection signals:**
- Valid JSON
- Not OpenAPI (no swagger/openapi keys)

**Analyze purpose from structure:**
```json
{
  "reference_type": "json_data",
  "detected_as": "Configuration" | "Data Schema" | "API Response Example" | "Test Fixture",
  "structure_analysis": {
    "root_type": "object|array",
    "top_level_keys": ["key1", "key2"],
    "nested_objects": ["key1.nested"],
    "inferred_purpose": "Looks like product data with id, name, metadata fields"
  },
  "plan_suggestions": {
    "if_config": ["Use these settings in implementation"],
    "if_data_schema": ["Model should match this structure"],
    "if_api_example": ["API response should match this format"]
  }
}
```

## Output Format

Return ONLY valid JSON:

```json
{
  "reference_type": "openapi|existing_plan|sql_schema|prisma_schema|graphql_schema|design_mockup|documentation|source_code|json_data|unknown",
  "detected_as": "Human-readable type description",
  "file_path": "original/path.ext",
  "analysis": {
    // Type-specific extracted data (see above)
  },
  "plan_integration": {
    "requirements_to_add": [
      {
        "description": "Requirement derived from reference",
        "source": "Which part of reference this came from",
        "priority": "high|medium|low"
      }
    ],
    "suggestions_to_add": {
      "api_designs": [],
      "code_snippets": [],
      "file_structures": [],
      "ui_components": [],
      "implementation_patterns": []
    },
    "decisions_to_inherit": [
      {"decision": "...", "rationale": "..."}
    ],
    "context_notes": "Key context to preserve in plan"
  }
}
```

## Guidelines

1. **Be intelligent**: Don't just extract - UNDERSTAND the reference
2. **Be relevant**: Only extract what's useful for planning
3. **Be specific**: Include concrete details, not vague summaries
4. **Cross-reference**: Consider how reference relates to conversation context
5. **Prioritize**: Mark relevance of extracted items
6. **Suggest integration**: Tell how to incorporate into the plan

## Why This Matters

A reference file is SOURCE MATERIAL for plan generation:
- Swagger → API phase gets real endpoints, not guesses
- SQL schema → Database phase knows existing tables
- Previous plan → Inherit relevant work, skip duplicates
- Design mockup → UI phase has concrete components
- Code files → Follow existing patterns, extend properly

**The reference INFORMS the plan. It doesn't get dumped as "context".**
