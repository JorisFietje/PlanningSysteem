import { useState, useEffect } from 'react'
import { StaffMember } from '@/types'
import { getStaffMembers } from '@/utils/staff/staffManagement'

export function useStaff() {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])

  useEffect(() => {
    loadStaffMembers()
  }, [])

  const loadStaffMembers = async () => {
    const loaded = await getStaffMembers()
    setStaffMembers(loaded)
  }

  return { staffMembers, setStaffMembers, loadStaffMembers }
}

