import { seatOccupantLabel } from './seatLabel.js';

/**
 * Seats whose person has been asked to decline: their guest asked the couple to free the
 * seat so the person can decline. Freeing the seat is what declines them.
 *
 * Only what the signed-in side can act on is listed: seats at its own tables, and at a
 * Common table only its own people (the other side's admin handles theirs).
 *
 * @param {{ id: string, table_number: number, table_name: string | null, side?: string, seats: object[] }[]} tables
 * @param {'bride' | 'groom'} party
 * @returns {{ tableId: string, tableNumber: number, tableName: string | null, seatId: string, seatNumber: number, name: string }[]}
 */
export function declineRequestSeats(tables = [], party) {
  const requests = [];
  for (const table of tables) {
    for (const seat of table.seats) {
      if (!seat.inviteeDeclineRequested || seat.occupantRsvpStatus === 'declined') continue;
      if (table.side === 'common' && seat.occupantSide && seat.occupantSide !== party) continue;
      requests.push({
        tableId: table.id,
        tableNumber: table.table_number,
        tableName: table.table_name,
        seatId: seat.id,
        seatNumber: seat.seatNumber,
        name: seatOccupantLabel(seat) ?? '',
      });
    }
  }
  return requests;
}
