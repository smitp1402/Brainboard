# Brainboard MCP Demo — Copy-Paste Commands

## SETUP COMMANDS

### Step 0A: Install globally
```bash
npm install -g brainboard-mcp
```

### Step 0B: Register with Claude Code
```bash
claude mcp add brainboard \
  --env BRAINBOARD_API_KEY=<your-api-key> \
  -- npx brainboard-mcp
```

---

## CLAUDE PROMPTS (paste into Claude)

### Step 1: Check Connection
```
Call the tool brainboard_check_connection
```

### Step 2: List Templates
```
Show me all available architecture templates on Brainboard
```

### Step 3: Clone a Template
```
Clone the "AWS Three Tier" template into my staging environment.
Name it: prod-staging-v2
Set these variables:
- region: us-east-1
- instance_type: t3.medium
- db_size: db.t3.small

Show me what was created.
```

### Step 4: List Workflows
```
What workflows are attached to the prod-staging-v2 architecture?
```

### Step 5: Trigger Terraform Plan
```
Run terraform plan on the prod-staging-v2 architecture.
Show me the output and tell me if everything looks good.
```

### Step 6: Version the Architecture
```
Create a version of prod-staging-v2 with commit message "Staging v2 setup"
```

---

## TIMING GUIDE

| Step | Duration | Command |
|------|----------|---------|
| 1. Check Connection | 30 sec | `brainboard_check_connection` |
| 2. List Templates | 30 sec | Show available templates |
| 3. Clone Template | 1 min | Clone AWS Three Tier |
| 4. List Workflows | 30 sec | Show workflows |
| 5. Terraform Plan | 1.5 min | Run terraform plan (wait) |
| 6. Version | 30 sec | Create version snapshot |
| **Total Demo** | **~5 min** | (plus intro/breakdown/Q&A = 10 min) |
