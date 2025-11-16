# DevOps Plugin - Infrastructure Management

You are managing infrastructure setup and configuration.

## Task: Infrastructure Management

The user wants to set up or manage cloud infrastructure.

### Step 1: Check Platform Support

1. Check if `.devops/config.json` exists
2. Read platform configuration:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/cli/devops-cli.js config get --key platform
   ```

3. **IMPORTANT**: Netlify is a fully managed platform - no manual infrastructure setup needed.

Show this message:
```
ℹ️  Infrastructure Management Not Needed

Platform: Netlify (Fully Managed)

Netlify automatically handles all infrastructure for you:
✓ Global CDN - Automatic edge distribution across 200+ PoPs
✓ SSL/TLS - Auto-provisioned and auto-renewed certificates
✓ DNS - Managed DNS with automatic configuration
✓ Build servers - Automatically scaled based on demand
✓ Serverless functions - Auto-deployed and auto-scaled
✓ Load balancing - Built-in, no configuration needed
✓ Caching - Intelligent edge caching
✓ DDoS protection - Included automatically

No manual infrastructure setup, configuration, or management needed!

What you CAN configure:
- Custom domains: Via Netlify dashboard or API
- Build settings: Automatically detected or via netlify.toml
- Environment variables: /devops:config or Netlify dashboard
- Redirect rules: Via netlify.toml or _redirects file
- Headers: Via netlify.toml or _headers file

To view Netlify infrastructure status: /devops:status infra

💡 For platforms requiring manual infrastructure (AWS, GCP, Azure),
   this plugin will support infrastructure-as-code in future releases.

Current platforms needing /devops:infra: None (Netlify is fully managed)
Coming soon: AWS (CloudFormation), GCP (Deployment Manager), Azure (ARM)
```

Then STOP.

---

**Why This Command Isn't Needed for Netlify**:

Netlify is a Platform-as-a-Service (PaaS) that abstracts away all infrastructure management:

**Traditional Cloud (AWS, GCP, Azure)**:
- You manage: VMs, containers, load balancers, networks, databases, storage
- You configure: Auto-scaling, health checks, SSL certificates, CDN
- You monitor: Server health, resource utilization, costs
- You update: OS patches, security updates, application deployments

**Netlify (Managed Platform)**:
- Netlify manages: Everything above automatically
- You focus on: Your application code
- You deploy: Via git push or CLI
- Infrastructure: Invisible, automatic, global

**What Netlify Handles Automatically**:
1. **CDN**: 200+ points of presence globally
2. **SSL/TLS**: Free certificates, auto-renewed
3. **Scaling**: Automatic, unlimited traffic
4. **Security**: DDoS protection, firewall, headers
5. **Performance**: Edge caching, asset optimization
6. **Availability**: 99.99% SLA, multi-region failover
7. **Monitoring**: Built-in analytics and logs

**When You WOULD Use /devops:infra**:
- AWS: Create VPC, EC2 instances, RDS databases, load balancers
- GCP: Set up Compute Engine, Cloud SQL, networking
- Azure: Provision App Services, Virtual Networks, databases

**When You DON'T Need /devops:infra**:
- Netlify: Everything is managed automatically
- Vercel: Same as Netlify, fully managed

**Future Support**:
This command will be available when AWS, GCP, or Azure support is added to the plugin.
Until then, it's not needed for Netlify deployments.
