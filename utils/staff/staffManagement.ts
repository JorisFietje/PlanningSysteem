import { StaffMember, DayOfWeek } from '@/types'

/**
 * Get all staff members from database
 */
export async function getStaffMembers(): Promise<StaffMember[]> {
  try {
    const response = await fetch('/api/staff')
    if (response.ok) {
      return await response.json()
    }
  } catch (error) {
    console.error('Failed to load staff members:', error)
  }
  
  // Return empty array if fetch fails (will be initialized on first GET)
  return []
}

/**
 * Add a new staff member
 */
export async function addStaffMember(staff: Omit<StaffMember, 'name'> & { name: string }): Promise<void> {
  const response = await fetch('/api/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(staff)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to add staff member')
  }
}

/**
 * Update an existing staff member
 */
export async function updateStaffMember(oldName: string, updates: Partial<StaffMember> & { name: string }): Promise<void> {
  const response = await fetch(`/api/staff/${encodeURIComponent(oldName)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update staff member')
  }
}

/**
 * Delete a staff member
 */
export async function deleteStaffMember(name: string): Promise<void> {
  const response = await fetch(`/api/staff/${encodeURIComponent(name)}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete staff member')
  }
}

/**
 * Get staff members for a specific day
 */
export async function getStaffForDay(day: DayOfWeek): Promise<StaffMember[]> {
  const all = await getStaffMembers()
  return all.filter(s => s.workDays.length === 0 || s.workDays.includes(day))
}

/**
 * Reset to default staff
 */
export async function resetToDefaults(): Promise<StaffMember[]> {
  const response = await fetch('/api/staff/reset', {
    method: 'POST'
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to reset staff members')
  }

  return await response.json()
}

