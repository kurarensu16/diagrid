-- Add a universal empty canvas mode with access to every toolbox category.
alter type diagram_type add value if not exists 'blank' before 'erd';
