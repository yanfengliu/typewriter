# Attempt 7: all four unchanged assemblies rejected by strict material witnesses

The bounded verification found a **real added-station-tab/rod intersection shared by all four frozen assemblies**. The45 mm and0 mm placements also have separate adjuster/rod intersections. The±90 mm adjuster envelopes cleared their declared sampled bank stage, but that does not clear their full assemblies. No geometry was changed or regenerated. Attempts6 and7 are used; attempt8 remains unused and no further comparison or construction is launched.

The source geometry remains the four exact attempt6 recipes bound by `addendum-manifest.json`, SHA256 `27963AA52183BBC7D49017990373C702E30B497B4B92BDD17106515D712C93C1`. The approved addendum is SHA `FFE7BCE6031FA1F2A46FE12AA2AFAAC5C642CC335CE48411ED5A153C7DC58D45`; execution freeze is `BA926673D89422642C9C7F128A6F3392EBC8BDA69AD7BD99519A96AD43FE43A3`. The three completed attempt6 connectivity proofs were reused only against their exact recipe hashes. No old connectivity query was repeated.

## Retained finite material evidence

`recovered-witnesses.json` is the primary numerical evidence. It contains the full bank primitive, actual common part/prism, world point, finite-cylinder axial/radial coordinates, and actual inner material-union containment. All margins below exceed the unchanged100 nm certainty threshold. These are interior witnesses, not AABB or capsule-end overlaps.

| Placement / feature | Pose and obstacle | Strict witness |
|---|---|---|
|45 mm, screw shaft|Bank scene5, `u=0.411`, `;:rod23:6`|Point `(44.603737,60.973836,-54.974741)` mm; ideal finite-cylinder margin88.610 µm; retained inner union also contains the point with at least0.4295 µm certified margin|
|0 mm, locknut wall|Bank scene3, `u=0.2466796875`, `h:rod23:5`|Point `(-0.099761,60.050855,-57.106627)` mm; finite-cylinder/inscribed-locknut-wall margin19.325 µm; actual hexagonal inner union margin8.4918 µm|
|All four, added station tab|Bank scene3, `u=0.2466796875`, `a:rod23:4`|Point `(-55.175283,58.345201,-57.279639)` mm lies on the finite rod centreline strictly inside `station-tab:a:0`; common/rod margin24.717 µm|

The shared tab is UB-local X-55.2…-54.4 mm, Y-11.75…-10.25 mm, Z-25…0 mm. Its exact canonical part hash is `35F48963349D6824EE2C0F554011F08AE07EE90759469FA7A4D592C4BFCEBDFA`. Each option has that identical finite part and the identical world UB transform `(origin=(0,69.2,-56.4) mm, angle=-0.2466796875)`. The same world witness was separately checked inside each option's **actual inner union**, with24.717 µm minimum margin in all four. The rod's axial parameter is0.9851668954, strictly between its endpoints; this is not an endcap inference. The offending part is a new rearward support tab, so the original rounded-station/hook contact permission does not apply.

This shared proof rejects all four exact recipes even though their module-specific branches differ. It does not claim that those different branches are identical, nor that every station tab collides. No pair was deleted or excused to obtain this result.

## Positive bounded result and separate access failure

The original stage log records that both±90 mm complete adjuster-envelope stages reached all13 retained bank states without a narrow-phase candidate: the new-query count stays61 across both stages. The frozen implementation included the spherical nose, entire1 mm shaft, boss, locknut/head and rest-only tool envelopes, testing them against all45 bank actions with100 µm expanded AABB rejection. The original per-pair in-memory object was lost to serialization; no finer minimum clearance number was retained or is claimed. This bounded positive result says the two outboard hardware regions avoid those sampled bank envelopes. It does not clear new supports, the fork, springs, common-body motion, unsampled states or the machine frame.

For every option, the real boss branch also enters the reserved rest nut-tool outer cylinder. The recovered UB-local witness is `(m-1.4,-8,-2.925)` mm:25 µm inside the branch and25 µm inside the reserved axial tool region. Actual material-union containment was checked for each option. This is a **reserved-access conflict**. The real wall of a hollow/open wrench was never defined, so `physicalToolWallCollisionProved` remains false; no new tool bore, opening or broad branch exemption was invented. The assemblies are independently rejected by the rod material witnesses, without depending on that tool-wall uncertainty.

## Serialization failure and bounded evidence recovery

The first pass reached the logged terminal result after34,188 new primitive queries and44 pose evaluations, but writing the final JSON failed because a NumPy boolean lacked a JSON conversion. Its exact script, stdout, stderr, freeze and process identity/cleanup remain verbatim in `failed-serialization/`; it exited with code1. A log line alone was not treated as sufficient retained numerical evidence.

Root authorized only the three named witness reconstructions and necessary per-option identity/containment/access checks within the remaining attempt7 allowance. Recovery freeze SHA is `F479EF73FF557170B1B1949FAF6863E8EBB7A76F32F9D38DA7942A2542F79134`. `recover-witnesses.py` reused the exact frozen numerical helpers and geometry bytes; its sole serialization change converts NumPy scalars through `item()`. It did not rerun the complete pass, change geometry or consume attempt8. It performed33 extra primitive queries and7 pose evaluations and recovered every named strict witness. No unretained finer coverage from the lost object is asserted.

Aggregate attempt7 cost is **34,221 new primitive queries,51 pose evaluations and44.4375 actual process CPU seconds**, within100,000/1,000/60. The first process used39.46875 CPU seconds; recovery used4.96875. Their hidden owned PIDs51168 and26532 both exited and were cleaned through the identity-checked `finally` path. There was no browser, GUI, server or child-process launch. Current and preserved cleanup records retain start times and terminal status.

## Omitted gates and practical limits

The early material rejection makes further enumeration unnecessary. The -90 option's remaining connectivity certification, full39 nominal/81 independent common/body/spring checks, every original31 common/141 bank regression class,100 µm whole-assembly clearance, finite-edge coverage, union mass/COM/inertia integration, reactions and dynamics remain uncompleted. No successful physical cycle follows from this work. Input shift samples were retained, but the decisive shared witness is at zero drop; it already rejects the assembly and does not establish the full shifted domain. There is no interval/swept or historical-dimension certificate.

The fixed base-to-external-chassis fasteners, complete chassis/platen connections, colour-locking control and structural elasticity remain explicit external boundaries. Root owns any later independent review, geometry authorization or canonical integration. All work here remains ignored output; canonical sources and public behavior were unchanged.

What this deliverable proves: these exact four assemblies are geometrically invalid; complete outboard adjuster hardware is a more promising sampled location than the two central options; and merely adding straight rearward station tabs creates a real collision even with unchanged station centres. What it does not prove: a different outboard assembly can be supported through collision-free finite corridors, acceptable mass/strength, source-authentic dimensions or realistic dynamic typing. The remaining attempt should not be spent by automatically nudging these tabs or trimming the tool conflict.
