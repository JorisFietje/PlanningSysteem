import { useState, useEffect, useCallback } from 'react'
import { StaffMember } from '@/types'
import { getStaffMembers } from '@/utils/staff/staffManagement'
import { mergeStaffWithWorkDays } from '@/utils/staff/workDays'

export function useStaff() {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])

  const loadStaffMembers = useCallback(async () => {
    const loaded = await getStaffMembers()
    setStaffMembers(mergeStaffWithWorkDays(loaded))
  }, [])

  useEffect(() => {
    loadStaffMembers()
  }, [loadStaffMembers])

  return { staffMembers, setStaffMembers, loadStaffMembers }
}
