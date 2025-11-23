import { getApiUrl, getAuthHeaders } from '@/config/api';

export interface Policy {
  id: number;
  type: 'privacy_policy' | 'terms_conditions';
  version: string;
  title: string;
  content: string;
  effective_date?: string;
  created_at: string;
}

export interface PolicyAcceptanceStatus {
  needs_privacy_policy: boolean;
  needs_terms: boolean;
  privacy_policy_version?: string;
  terms_version?: string;
}

class PolicyApi {
  /**
   * Get the latest active privacy policy
   */
  async getPrivacyPolicy(): Promise<Policy> {
    const url = getApiUrl('/policies/privacy-policy');
    console.log('[PolicyApi] Fetching privacy policy from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[PolicyApi] Privacy policy fetch failed:', response.status, errorData);
      throw new Error(errorData.message || `Failed to fetch privacy policy (${response.status})`);
    }

    const data = await response.json();
    console.log('[PolicyApi] Privacy policy fetched:', data);
    
    if (!data.policy) {
      throw new Error('Privacy policy not found in response');
    }
    
    return data.policy;
  }

  /**
   * Get the latest active terms and conditions
   */
  async getTermsConditions(): Promise<Policy> {
    const url = getApiUrl('/policies/terms-conditions');
    console.log('[PolicyApi] Fetching terms from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[PolicyApi] Terms fetch failed:', response.status, errorData);
      throw new Error(errorData.message || `Failed to fetch terms and conditions (${response.status})`);
    }

    const data = await response.json();
    console.log('[PolicyApi] Terms fetched:', data);
    
    if (!data.policy) {
      throw new Error('Terms and conditions not found in response');
    }
    
    return data.policy;
  }

  /**
   * Accept privacy policy
   */
  async acceptPrivacyPolicy(version: string): Promise<void> {
    const response = await fetch(`${getApiUrl()}/policies/privacy-policy/accept`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ version }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to accept privacy policy');
    }
  }

  /**
   * Accept terms and conditions
   */
  async acceptTerms(version: string): Promise<void> {
    const response = await fetch(`${getApiUrl()}/policies/terms-conditions/accept`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ version }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to accept terms and conditions');
    }
  }

  /**
   * Check if user needs to accept updated policies
   */
  async checkPolicyAcceptance(): Promise<PolicyAcceptanceStatus> {
    const response = await fetch(`${getApiUrl()}/policies/check-acceptance`, {
      method: 'GET',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to check policy acceptance');
    }

    return await response.json();
  }

  /**
   * Get all policies (Admin only)
   */
  async getAllPolicies(type?: string): Promise<Policy[]> {
    const url = type 
      ? `${getApiUrl()}/admin/policies?type=${type}`
      : `${getApiUrl()}/admin/policies`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch policies');
    }

    const data = await response.json();
    return data.policies;
  }

  /**
   * Create a new policy (Admin only)
   */
  async createPolicy(policy: {
    type: 'privacy_policy' | 'terms_conditions';
    version: string;
    title: string;
    content: string;
    effective_date?: string;
    is_active?: boolean;
  }): Promise<Policy> {
    const response = await fetch(`${getApiUrl()}/admin/policies`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(policy),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create policy');
    }

    const data = await response.json();
    return data.policy;
  }

  /**
   * Update a policy (Admin only)
   */
  async updatePolicy(id: number, policy: {
    version?: string;
    title?: string;
    content?: string;
    effective_date?: string;
    is_active?: boolean;
  }): Promise<Policy> {
    const response = await fetch(`${getApiUrl()}/admin/policies/${id}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(policy),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update policy');
    }

    const data = await response.json();
    return data.policy;
  }

  /**
   * Activate a policy (Admin only)
   */
  async activatePolicy(id: number): Promise<void> {
    const response = await fetch(`${getApiUrl()}/admin/policies/${id}/activate`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to activate policy');
    }
  }
}

export const policyApi = new PolicyApi();

