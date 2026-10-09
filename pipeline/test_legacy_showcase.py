"""Tests for the legacy-run showcase adapter. Standard library only.
Synthetic fixtures below exist ONLY inside temporary directories for testing; they are never published."""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import legacy_showcase as legacy  # noqa: E402

RUN_ID = "3b01cdb5674a44ea9c6c3d17ec8c07b8"
LOOSE = HERE / "output"


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value)
    path.write_text(text, encoding="utf-8")
    return len(text)


@unittest.skipUnless((LOOSE / "last_attempt.json").is_file(), "legacy last_attempt.json not present")
class LegacyShowcase(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.run = self.tmp / "runs" / RUN_ID
        self.run.mkdir(parents=True)
        for item in LOOSE.iterdir():
            if item.is_file():
                shutil.copy(item, self.run / item.name)
        self.out = self.tmp / "out"
        self.out.mkdir()
        self.manifest = json.loads((self.run / "last_attempt.json").read_text())

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def export(self):
        return legacy.export_legacy(self.run, self.out, RUN_ID, ROOT, write_json)

    def test_detected_as_legacy(self):
        self.assertTrue(legacy.is_legacy_run(self.run))

    def test_inconsistent_loose_files_are_not_exported_as_real(self):
        """The loose pulse/patch files in the repo are demo files (wrong site, wrong dates, wrong location)."""
        summary = self.export()
        self.assertEqual(summary["completeness"], "METADATA_ONLY")
        self.assertFalse((self.out / "pulse.json").exists())
        self.assertFalse((self.out / "patches").exists())
        self.assertFalse((self.out / "sensitivity.json").exists())
        reasons = " ".join(item["reason"] for item in summary["skipped"])
        self.assertIn("Hakaluki", reasons)
        self.assertIn("outside the run's study bounds", reasons)

    def test_exports_only_real_acquisition_metadata_and_verified_boundary(self):
        self.export()
        manifest = json.loads((self.out / "manifest.json").read_text())
        self.assertEqual(manifest["observation_count"], 7)
        self.assertEqual(manifest["observation_dates"][0], "2026-06-30")
        self.assertEqual(manifest["observation_dates"][-1], "2026-09-22")
        self.assertEqual(manifest["product"], "NISAR_L2_GCOV_PROVISIONAL_V1")
        self.assertFalse(manifest["reference_validated"])
        self.assertFalse(manifest["availability"]["pulse"])
        self.assertTrue(manifest["availability"]["boundary"])
        self.assertEqual(manifest["radar_dates"], [])
        self.assertTrue(any("provisional" in text for text in manifest["limitations"]))
        self.assertTrue(any("not confirmed flooding" in text for text in manifest["limitations"]))
        observations = json.loads((self.out / "observations.json").read_text())
        self.assertTrue(all(item["patches_file"] is None for item in observations))

    def test_never_copies_rasters_or_credentials(self):
        self.export()
        names = [p.suffix.lower() for p in self.out.rglob("*") if p.is_file()]
        self.assertNotIn(".tif", names)
        self.assertNotIn(".png", names)
        blob = " ".join(p.read_text() for p in self.out.rglob("*.json"))
        self.assertNotIn(str(self.tmp), blob)

    def test_refuses_wrong_identity_status_source_product(self):
        for key, value in (("run_id", "f" * 32), ("status", "FAILED"), ("data_source", "SIMULATED_DEMO"), ("product", "OTHER")):
            broken = dict(self.manifest, **{key: value})
            write_json(self.run / "last_attempt.json", broken)
            with self.assertRaises(legacy.LegacyRunError, msg=key):
                legacy.validate_manifest(broken, RUN_ID)

    def test_consistent_derived_files_are_exported_for_the_selected_date_only(self):
        """Synthetic, self-consistent derived files (test fixture only)."""
        dates = legacy.validate_manifest(self.manifest, RUN_ID)["observation_dates"]
        bounds = self.manifest["site_bounds"]
        cx, cy = (bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2
        ring = [[cx, cy], [cx + 0.01, cy], [cx + 0.01, cy + 0.01], [cx, cy]]
        props = {"id": "p1", "date": self.manifest["selected_date"], "area_km2": 2.0, "classification": "OPEN_WATER", "quality_status": "PASS",
                 "spatial_status": "PASS", "temporal_status": "PASS", "threshold_stability": "STABLE", "evidence_state": "SUPPORTED",
                 "mean_delta_db": -3.0, "valid_fraction": 0.9, "centroid": [cy, cx]}
        write_json(self.run / "patches_final.geojson", {"type": "FeatureCollection", "features": [{"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [ring]}, "properties": props}]})
        write_json(self.run / "wetland_pulse.json", {"site": self.manifest["site_name"], "onset": dates[0], "recession_start": dates[-2],
                   "peak": {"date": self.manifest["selected_date"], "area_km2": 2.0},
                   "dates": [{"date": d, "area_km2": 1.0 + i, "fraction": 0.1, "mean_delta_db": 1.0, "patches": 1} for i, d in enumerate(dates)]})
        write_json(self.run / "sensitivity_results.json", {"thresholds": [{"delta_db": 2.0, "area_km2": 2.0, "patches": 1}], "stability_verdict": "STABLE", "stable_range": [1, 3], "sensitivity_note": "fixture"})
        summary = self.export()
        self.assertEqual(summary["completeness"], "PARTIAL")
        self.assertEqual(summary["patch_dates"], [self.manifest["selected_date"]])
        observations = json.loads((self.out / "observations.json").read_text())
        with_files = [o["date"] for o in observations if o["patches_file"]]
        self.assertEqual(with_files, [self.manifest["selected_date"]])
        self.assertTrue((self.out / "pulse.json").exists())


class ModernExporterUnchanged(unittest.TestCase):
    def test_modern_run_still_exports(self):
        rid = "c" * 32
        run = HERE / "output" / "runs" / rid
        case = "selftest-modern"
        out = ROOT / "public" / "showcase" / case
        try:
            fc = {"type": "FeatureCollection", "features": [{"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[[91.1, 24.1], [91.2, 24.1], [91.2, 24.2], [91.1, 24.1]]]}, "properties": {"id": "p"}}]}
            write_json(run / "run_manifest.json", {"status": "COMPLETE", "data_source": "NISAR", "run_id": rid, "site_name": "T"})
            write_json(run / "wetland_pulse.json", {"dates": [{"date": "2026-06-18"}], "peak": {"date": "2026-06-18"}})
            write_json(run / "site_boundary.geojson", fc)
            write_json(run / "p0.geojson", fc)
            write_json(run / "sensitivity_results.json", {"thresholds": []})
            write_json(run / "observations.json", [{"date": "2026-06-18", "patches_file": "p0.geojson"}])
            result = subprocess.run([sys.executable, str(HERE / "export_showcase.py"), "--run-id", rid, "--case-id", case, "--no-radar"], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            manifest = json.loads((out / "manifest.json").read_text())
            self.assertNotIn("legacy_format", manifest)
            self.assertTrue((out / "patches" / "2026-06-18.geojson").exists())
        finally:
            shutil.rmtree(out, ignore_errors=True)
            shutil.rmtree(run, ignore_errors=True)
            runs = HERE / "output" / "runs"
            if runs.exists() and not any(runs.iterdir()):
                runs.rmdir()


if __name__ == "__main__":
    unittest.main()
