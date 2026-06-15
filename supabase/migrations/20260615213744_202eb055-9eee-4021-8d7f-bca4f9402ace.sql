-- Allow any employee with write access to the location (not only owners) to manage location_settings.
DROP POLICY IF EXISTS location_settings_insert_strict ON public.location_settings;
DROP POLICY IF EXISTS location_settings_update_strict ON public.location_settings;

CREATE POLICY location_settings_insert_strict
  ON public.location_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_location_writable_by(auth.uid(), location_id));

CREATE POLICY location_settings_update_strict
  ON public.location_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_location_writable_by(auth.uid(), location_id))
  WITH CHECK (public.is_location_writable_by(auth.uid(), location_id));