alter table if exists blocks
  alter column order_index type double precision
  using order_index::double precision;
