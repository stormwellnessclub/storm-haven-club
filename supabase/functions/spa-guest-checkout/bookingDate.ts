// Match the red-light / dry-cryo names supported by the public wellness menu.
const sameDayWellness = /red light|red-light|redlight|infrared|dry cryo|dry-cryo|drycryo|cryotherapy|cryo therapy|zerobody|zero body/i;

export function guestBookingDateError(
  service: { name: string; category: string }, date: string, time: string, now = new Date(),
): string | null {
  const fields = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const part = (key: string) => fields.find(f => f.type === key)?.value ?? '';
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const eligible = service.category === 'Recovery' && sameDayWellness.test(service.name);
  if (date < today || (date === today && !eligible) || date > new Date(now.getTime() + 94 * 86400000).toISOString().slice(0, 10)) {
    return 'Choose an eligible appointment date within three months.';
  }
  if (date === today) {
    const startSeconds = Number(time.slice(0, 2)) * 3600 + Number(time.slice(3, 5)) * 60;
    const currentSeconds = Number(part('hour')) * 3600 + Number(part('minute')) * 60 + Number(part('second'));
    if (startSeconds < currentSeconds + 20 * 60) return 'Choose a time at least 20 minutes from now.';
  }
  return null;
}