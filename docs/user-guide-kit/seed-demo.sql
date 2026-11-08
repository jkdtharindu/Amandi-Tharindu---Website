INSERT INTO guests (code,name,relationship,slot_count,whatsapp_number,rsvp_status,assigned_to_party) VALUES
('REL-PE-123','Perera Family','Relations',3,'+94 77 123 4567','accepted','bride'),
('REL-SI-482','Nimal Silva','Relations',1,'0714849297','pending','bride'),
('FRI-KA-205','Kasun & Dilini','Friends',2,'+94 76 555 0142','accepted','bride'),
('FRI-NA-731','Nadeesha Fernando','Friends',1,'+94 70 222 8890','pending','bride'),
('COL-RA-318','Ruwan Jayasinghe','Colleagues',1,'+94 71 333 4411','pending','bride'),
('NEI-SA-904','Samarasinghe Family','Neighbours',4,'+94 75 808 1020','pending','bride'),
('REL-GU-557','Gunawardena Family','Relations',2,NULL,'pending','bride');
INSERT INTO invitees (guest_id,name,rsvp_status,display_order)
SELECT id,n,'accepted',o FROM guests, (VALUES ('Nimal Perera',1),('Kamala Perera',2),('Sunil Perera',3)) v(n,o) WHERE code='REL-PE-123';
INSERT INTO invitees (guest_id,name,rsvp_status,display_order)
SELECT id,n,'accepted',o FROM guests, (VALUES ('Kasun Rathnayake',1),('Dilini Rathnayake',2)) v(n,o) WHERE code='FRI-KA-205';
INSERT INTO invitees (guest_id,name,rsvp_status,display_order)
SELECT id,n,'pending',o FROM guests, (VALUES ('Mala Samarasinghe',1),('Ajith Samarasinghe',2),('Chamari Samarasinghe',3),('Ishan Samarasinghe',4)) v(n,o) WHERE code='NEI-SA-904';
INSERT INTO seating_tables (table_number,table_name,capacity,assigned_to_party) VALUES (1,'Rose',10,'bride'),(2,'Lotus',10,'bride');
INSERT INTO table_seats (seating_table_id,seat_number,invitee_id)
SELECT t.id,s.sn,i.id FROM seating_tables t JOIN (VALUES ('Rose',1,'Nimal Perera'),('Rose',2,'Kamala Perera'),('Lotus',1,'Sunil Perera'),('Rose',3,'Kasun Rathnayake'),('Rose',4,'Dilini Rathnayake')) s(tn,sn,iname) ON t.table_name=s.tn JOIN invitees i ON i.name=s.iname;
INSERT INTO message_events (guest_id,event_name,sent_by_party,is_completed)
SELECT id,e,'bride',true FROM guests, (VALUES ('Main Invitation'),('Guest Code')) v(e) WHERE code IN ('REL-PE-123','FRI-KA-205');
INSERT INTO message_events (guest_id,event_name,sent_by_party,is_completed)
SELECT id,'Main Invitation','bride',true FROM guests WHERE code IN ('REL-SI-482','FRI-NA-731');
