/**
 * Secrets Manager
 *
 * Dual-mode secrets management:
 * 1. Local encrypted storage (for development)
 * 2. External providers (call cloud CLIs for AWS/GCP/Azure)
 *
 * Uses ONLY Node.js built-in modules (zero dependencies)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class SecretsManager {
  constructor(rootPath = process.cwd(), mode = 'local') {
    this.rootPath = rootPath;
    this.mode = mode;
    this.secretsDir = path.join(rootPath, '.devops');
    this.secretsFile = path.join(this.secretsDir, 'credentials.enc');
    this.masterKey = process.env.DEVOPS_MASTER_KEY || this._getDefaultKey();

    // Ensure 32-byte key for AES-256
    this.keyBuffer = crypto.createHash('sha256').update(this.masterKey).digest();
  }

  /**
   * Get default master key (INSECURE - for development only)
   */
  _getDefaultKey() {
    console.warn('Warning: Using default master key. Set DEVOPS_MASTER_KEY environment variable for production.');
    return 'devops-default-key-change-me';
  }

  /**
   * Ensure directory exists
   */
  _ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Encrypt data using AES-256-CBC
   */
  _encrypt(data) {
    const iv = crypto.randomBytes(16); // Initialization vector
    const cipher = crypto.createCipheriv('aes-256-cbc', this.keyBuffer, iv);

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Prepend IV to encrypted data (IV is not secret)
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt data using AES-256-CBC
   */
  _decrypt(encryptedData) {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv('aes-256-cbc', this.keyBuffer, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * Load secrets from local storage
   */
  _loadLocalSecrets() {
    if (!fs.existsSync(this.secretsFile)) {
      return {};
    }

    try {
      const encrypted = fs.readFileSync(this.secretsFile, 'utf8');
      return this._decrypt(encrypted);
    } catch (error) {
      throw new Error('Failed to decrypt secrets. Check DEVOPS_MASTER_KEY.');
    }
  }

  /**
   * Save secrets to local storage
   */
  _saveLocalSecrets(secrets) {
    this._ensureDir(this.secretsDir);
    const encrypted = this._encrypt(secrets);
    fs.writeFileSync(this.secretsFile, encrypted, 'utf8');
  }

  /**
   * Set a secret (local mode)
   */
  setSecretLocal(name, value, metadata = {}) {
    const secrets = this._loadLocalSecrets();

    secrets[name] = {
      value,
      created: secrets[name]?.created || new Date().toISOString(),
      updated: new Date().toISOString(),
      metadata
    };

    this._saveLocalSecrets(secrets);

    // Create backup
    const backupDir = path.join(this.secretsDir, 'secrets-backup');
    this._ensureDir(backupDir);
    const backupFile = path.join(backupDir, `${name}-${Date.now()}.enc`);
    fs.writeFileSync(backupFile, this._encrypt({ [name]: secrets[name] }));

    return {
      success: true,
      name,
      encrypted: true,
      storage: 'local'
    };
  }

  /**
   * Get a secret (local mode)
   */
  getSecretLocal(name, masked = false) {
    const secrets = this._loadLocalSecrets();

    if (!secrets[name]) {
      throw new Error(`Secret not found: ${name}`);
    }

    const secret = secrets[name];

    if (masked && secret.value) {
      const val = secret.value.toString();
      const maskedValue = val.length > 8 ?
        val.substring(0, 4) + '••••••••••••' + val.substring(val.length - 4) :
        '••••••••';

      return {
        name,
        value: maskedValue,
        masked: true,
        created: secret.created,
        updated: secret.updated,
        metadata: secret.metadata
      };
    }

    return {
      name,
      value: secret.value,
      masked: false,
      created: secret.created,
      updated: secret.updated,
      metadata: secret.metadata
    };
  }

  /**
   * List all secrets (local mode)
   */
  listSecretsLocal() {
    const secrets = this._loadLocalSecrets();

    return Object.keys(secrets).map(name => ({
      name,
      created: secrets[name].created,
      updated: secrets[name].updated,
      metadata: secrets[name].metadata,
      status: 'valid'
    }));
  }

  /**
   * Delete a secret (local mode)
   */
  deleteSecretLocal(name) {
    const secrets = this._loadLocalSecrets();

    if (!secrets[name]) {
      throw new Error(`Secret not found: ${name}`);
    }

    // Create final backup
    const backupDir = path.join(this.secretsDir, 'secrets-backup', Date.now().toString());
    this._ensureDir(backupDir);
    const backupFile = path.join(backupDir, `${name}.enc`);
    fs.writeFileSync(backupFile, this._encrypt({ [name]: secrets[name] }));

    delete secrets[name];
    this._saveLocalSecrets(secrets);

    return {
      success: true,
      name,
      backupPath: backupFile
    };
  }

  /**
   * Validate secrets (local mode)
   */
  validateSecretsLocal() {
    const secrets = this._loadLocalSecrets();
    const results = [];

    for (const [name, secret] of Object.entries(secrets)) {
      const validation = {
        name,
        encrypted: true,
        accessible: true,
        format: 'valid',
        length: secret.value ? secret.value.toString().length : 0,
        warnings: []
      };

      // Check length
      if (validation.length < 8) {
        validation.warnings.push('Secret length is short (< 8 chars)');
      }

      results.push(validation);
    }

    return results;
  }

  /**
   * Rotate a secret (local mode)
   */
  rotateSecretLocal(name, newValue = null) {
    const secrets = this._loadLocalSecrets();

    if (!secrets[name]) {
      throw new Error(`Secret not found: ${name}`);
    }

    // Archive old value
    const archiveDir = path.join(this.secretsDir, 'secrets-backup', Date.now().toString());
    this._ensureDir(archiveDir);
    const archiveFile = path.join(archiveDir, `${name}.enc`);
    fs.writeFileSync(archiveFile, this._encrypt({ [name]: secrets[name] }));

    // Generate new value if not provided
    if (!newValue) {
      newValue = crypto.randomBytes(16).toString('hex');
    }

    // Update secret
    secrets[name].value = newValue;
    secrets[name].updated = new Date().toISOString();
    secrets[name].rotated = new Date().toISOString();

    this._saveLocalSecrets(secrets);

    return {
      success: true,
      name,
      rotated: true,
      archivePath: archiveFile
    };
  }

  // ========================================================================
  // PUBLIC API (mode-aware)
  // ========================================================================

  setSecret(name, value, metadata = {}) {
    switch (this.mode) {
      case 'local':
        return this.setSecretLocal(name, value, metadata);
      case 'aws':
        return this.setSecretAWS(name, value, metadata);
      case 'gcp':
        return this.setSecretGCP(name, value, metadata);
      case 'azure':
        return this.setSecretAzure(name, value, metadata);
      default:
        throw new Error(`Unsupported secrets mode: ${this.mode}`);
    }
  }

  getSecret(name, masked = false) {
    switch (this.mode) {
      case 'local':
        return this.getSecretLocal(name, masked);
      case 'aws':
        return this.getSecretAWS(name, masked);
      case 'gcp':
        return this.getSecretGCP(name, masked);
      case 'azure':
        return this.getSecretAzure(name, masked);
      default:
        throw new Error(`Unsupported secrets mode: ${this.mode}`);
    }
  }

  listSecrets() {
    switch (this.mode) {
      case 'local':
        return this.listSecretsLocal();
      default:
        return [];
    }
  }

  // ========================================================================
  // EXTERNAL PROVIDER IMPLEMENTATIONS (via cloud CLIs)
  // ========================================================================

  setSecretAWS(name, value, metadata) {
    try {
      // Call aws secretsmanager CLI
      const command = `aws secretsmanager create-secret --name "${name}" --secret-string "${value}" --output json`;
      const result = execSync(command, { encoding: 'utf8' });
      const data = JSON.parse(result);

      return {
        success: true,
        name,
        arn: data.ARN,
        storage: 'AWS Secrets Manager'
      };
    } catch (error) {
      // Try update if create fails (secret might exist)
      try {
        const updateCommand = `aws secretsmanager update-secret --secret-id "${name}" --secret-string "${value}" --output json`;
        execSync(updateCommand, { encoding: 'utf8' });

        return {
          success: true,
          name,
          updated: true,
          storage: 'AWS Secrets Manager'
        };
      } catch (updateError) {
        return {
          success: false,
          error: 'AWS Secrets Manager not available or authentication failed'
        };
      }
    }
  }

  getSecretAWS(name, masked) {
    try {
      const command = `aws secretsmanager get-secret-value --secret-id "${name}" --output json`;
      const result = execSync(command, { encoding: 'utf8' });
      const data = JSON.parse(result);

      const value = data.SecretString;
      const maskedValue = masked && value ?
        (value.length > 8 ? value.substring(0, 4) + '••••••••••••' + value.substring(value.length - 4) : '••••••••') :
        value;

      return {
        name,
        value: maskedValue,
        masked,
        created: data.CreatedDate,
        updated: data.LastChangedDate
      };
    } catch (error) {
      throw new Error('AWS Secrets Manager not available or secret not found');
    }
  }

  setSecretGCP(name, value, metadata) {
    try {
      // Call gcloud secrets CLI
      const command = `echo -n "${value}" | gcloud secrets create "${name}" --data-file=- --format=json`;
      execSync(command, { encoding: 'utf8' });

      return {
        success: true,
        name,
        storage: 'GCP Secret Manager'
      };
    } catch (error) {
      return {
        success: false,
        error: 'GCP Secret Manager not available or authentication failed'
      };
    }
  }

  getSecretGCP(name, masked) {
    try {
      const command = `gcloud secrets versions access latest --secret="${name}"`;
      const value = execSync(command, { encoding: 'utf8' }).trim();

      const maskedValue = masked && value ?
        (value.length > 8 ? value.substring(0, 4) + '••••••••••••' + value.substring(value.length - 4) : '••••••••') :
        value;

      return {
        name,
        value: maskedValue,
        masked
      };
    } catch (error) {
      throw new Error('GCP Secret Manager not available or secret not found');
    }
  }

  setSecretAzure(name, value, metadata) {
    try {
      // Call az keyvault CLI
      const vaultName = process.env.AZURE_KEYVAULT_NAME;
      if (!vaultName) {
        throw new Error('AZURE_KEYVAULT_NAME environment variable not set');
      }

      const command = `az keyvault secret set --vault-name "${vaultName}" --name "${name}" --value "${value}" --output json`;
      execSync(command, { encoding: 'utf8' });

      return {
        success: true,
        name,
        storage: 'Azure Key Vault'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Azure Key Vault not available or authentication failed'
      };
    }
  }

  getSecretAzure(name, masked) {
    try {
      const vaultName = process.env.AZURE_KEYVAULT_NAME;
      if (!vaultName) {
        throw new Error('AZURE_KEYVAULT_NAME environment variable not set');
      }

      const command = `az keyvault secret show --vault-name "${vaultName}" --name "${name}" --output json`;
      const result = execSync(command, { encoding: 'utf8' });
      const data = JSON.parse(result);

      const value = data.value;
      const maskedValue = masked && value ?
        (value.length > 8 ? value.substring(0, 4) + '••••••••••••' + value.substring(value.length - 4) : '••••••••') :
        value;

      return {
        name,
        value: maskedValue,
        masked
      };
    } catch (error) {
      throw new Error('Azure Key Vault not available or secret not found');
    }
  }
}

module.exports = SecretsManager;
