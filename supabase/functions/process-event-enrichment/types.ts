export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface OpeningPeriod {
  open: string;
  close: string;
  closes_next_day?: boolean;
}

export type DailySchedule = OpeningPeriod[] | 'closed';

export interface OpeningHours {
  always_open?: boolean;
  monday?: DailySchedule;
  tuesday?: DailySchedule;
  wednesday?: DailySchedule;
  thursday?: DailySchedule;
  friday?: DailySchedule;
  saturday?: DailySchedule;
  sunday?: DailySchedule;
}
