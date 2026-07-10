-- =============================================================================
-- 0036 - Progress photo quality provenance
-- =============================================================================
-- Quality values written before this migration came from timer-driven preview
-- fixtures, not captured-file measurement. Remove that false precision and make
-- provenance mandatory for every future coarse quality/pose value.

alter table public.photos
  add column quality_source text;

update public.photos
set
  alignment_score = null,
  lighting_score = null,
  head_roll = null,
  head_yaw = null,
  head_pitch = null,
  quality_source = null;

alter table public.photos
  add constraint photos_quality_source_allowed
    check (quality_source is null or quality_source = 'post_capture_measurement'),
  add constraint photos_quality_metadata_requires_source
    check (
      quality_source = 'post_capture_measurement'
      or (
        quality_source is null
        and alignment_score is null
        and lighting_score is null
        and head_roll is null
        and head_yaw is null
        and head_pitch is null
      )
    );

comment on column public.photos.quality_source is
  'Provenance for coarse capture-comparability metadata; never a biometric or skin score.';
