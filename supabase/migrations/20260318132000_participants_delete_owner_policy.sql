-- Allow group owner to remove participants (except owner row handled by app logic).

drop policy if exists participants_delete_owner_or_self on public.participants;

create policy participants_delete_owner_or_self
on public.participants
for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.groups g
    where g.id = participants.group_id
      and g.owner_id = auth.uid()
  )
);

