# Review 31: fixed screw feasibility

## Target

Frozen common-lift candidate 4, SHA-256 A263C58025F7A20255D095F2AE0676A4F973D0DF4FED16D6E797EE3133581E53; completed manifest 4BFC1F1636DB3DBB0F03F887C16FFE8B1BB6A48C33449C1A2210A1E1E9AD906E. This is a read-only feasibility review, not acceptance of the rejected assembly or a fifth geometry construction.

## Reviewers and coverage

Fresh independent screw_corridor_review, gpt-6-astra at xhigh, without author proposal or preflight conclusions. Primary-source distinction, exact finite cylinder witnesses, seven predeclared screw-axis intervals and nominal pad arithmetic.

## Reports

### screw_corridor_review

Authored report retained without substantive edits. Primary output/screw-corridor-review/report.md SHA-256 5bc99587e4a9f9ce82d97c2d00ce27d5981cae41f0c08f563e6a8ef28c9ecbba.

> # Independent screw-corridor review
>
> **The frozen 1.0 mm diameter, 3.0 mm long straight stem is physically blocked. Its upright is independently blocked too. The fixed spherical datum is not itself blocked in the 13 retained bank placements. A narrower straight stem has positive sampled rod clearance, so these results do not prove the frozen contact datums impossible; they also do not establish a complete screw, finite threaded support and load path that clears the common linkage.** No candidate was constructed or accepted.
>
> This 2026-11-08 bounded review was completed before reading `proposal5.md` or any new-worker recipe or result. The independent pre-probe record is `independent-evidence-before-probe.md`. `probe.py` ran once, in 0.995 s internally and 1.46 s tool wall time, after the coordinator released CPU. It used the standard library, seven fixed axial intervals and the existing 13 bank placements. No optimization, new solid, large sweep, browser or dynamic solver ran. The source candidate manifest and frozen JSON matched the requested hashes `4BFC1F1636DB3DBB0F03F887C16FFE8B1BB6A48C33449C1A2210A1E1E9AD906E` and `A263C58025F7A20255D095F2AE0676A4F973D0DF4FED16D6E797EE3133581E53`.
>
> ## Requirements versus estimates
>
> I inspected retained primary Royal1955 printed32/PDF33 text, printed33/PDF34 Figure12, and the Ames1968 lift mounting crop, as well as the previous source-parent and point-contract reviews. Royal text places screw9 on the UB, bearing on lift7, whose stud pushes the link heel. Figure12 explicitly identifies part9 as the ribbon throw adjusting screw and locknut. The later illustration shows a straight lower screw. A usable reconstruction therefore needs a real adjustment joint and a compressive load path into the UB, rather than a spherical contact joined to an arbitrary fused bracket.
>
> The carried hinge remains the reviewed cross-figure inference. None of these pages measures the screw diameter, straight-stem length, exact axis orientation, female-thread diameter and engagement, wall thickness, head or locknut size, or axial adjustment interval. Those are replaceable engineering estimates. The source does not require the rejected 0.5 mm stem radius, 3 mm stem length, side crossbrace, 0.8 mm engagement-like interval, or upright route. The immutable bank and frozen contact datums are constraints of this engineering comparison, not historically measured dimensions. A changed axis or adjustment range must be disclosed as a changed estimate and have its contact coverage recomputed.
>
> ## Exact datums and material witnesses
>
> All coordinates below are millimetres unless otherwise stated. In the UB frame the sphere center is S=(45,-8,0), radius 0.75. The current stem axis is S+(0,0,z), z in [-3,0], with radius 0.5. The lift hinge is h=(45,2,5); the nominal relative stop is phi=0.024848206539648046 rad; the pad's nominal local contact is (0,-10.121141239999,-4). The source sphere and pad remain required finite contact geometry, not replaceable point markers.
>
> At bank scene7 (`held`, u=0.421 rad), the rod `;:rod23:6` has UB endpoints A=(43.9275804165891,-6.99709518829895,-3.50005656012603) and B=(45.0913352405378,-11.2247137021748,2.02039780621647), radius 0.45. The nearest axis and rod points occur strictly inside both segments: axis z=-1.92436879075545 and rod parameter 0.285427188562112. Their distance is 0.767786887442097 mm. The sum of current cylinder radii is 0.95 mm, yielding 0.182213112557903 mm radial overlap. Because both closest points are interior, this is a real cylindrical obstruction, not an artifact of round endpoint caps.
>
> The independent strict witness at world point (44.54375,60.9568317553355,-55.0350570118116) becomes UB point (44.54375,-8.08119656362461,-2.12300592813861). Its radial/end-boundary margin inside the current flat-ended stem is 0.0365812428866920 mm and its finite-rod interior margin is 0.130696321631271 mm. This reproduces a retained diagnostic witness using exact cylinder arithmetic instead of the candidate's polygon sections. No narrower drawing of the same radius can remove it.
>
> The support upright also fails separately. At the same scene, world point (47.2447783734156,62.7010777488433,-56.1195774568101) is UB point (47.2447783734156,-6.04604227816092,-2.40000000000000). It lies 0.244778373415570 mm inside the upright box and on the centerline of `-:rod23:4`, with 0.45 mm radial rod margin. Relocating only the boss or narrowing only the stem leaves this support defect.
>
> The required sphere has a positive minimum separation of 0.221989207386237 mm from the retained rod capsules, again at scene7 and `;:rod23:6`. This verifies the earlier sphere diagnostic but cannot clear the omitted screw components. The original 31 definite common intersections and 99 bank material witnesses remain rejection evidence; this review neither recounts them as clearance nor replaces their checks. In particular, the retained upper web intersects common link/cam material, so a new load path cannot inherit clearance merely by reconnecting to that web unchanged.
>
> ## What room exists on the unchanged axis
>
> For each interval, the table gives the minimum distance from its axis segment to every rod23 capsule centerline in all 13 retained placements, less the rod radius. A tube capsule with any smaller radius is therefore clear of those rods at those placements. These are sufficient capsule bounds, not all-obstacle or swept-volume clearances; endpoint rows need not be necessary bounds for a flat-ended cylinder. The complete stem row is a necessary as well as sufficient bound at its interior bottleneck.
>
> | UB Z interval relative to S, mm | Radius at zero capsule gap, mm | Limiting scene and rod |
> |---|---:|---|
> | Existing complete stem [-3,0] | 0.317786887442 | 7, `;:rod23:6` |
> | Existing boss interval [-2.8,-2.0] | 0.319226546339 | 7, `;:rod23:6` |
> | Nose interval [-0.75,0] | 0.609721044883 | 7, `;:rod23:6` |
> | First exposed interval [-1.5,-0.75] | 0.361888473690 | 7, `;:rod23:6` |
> | Middle exposed interval [-2.0,-1.5] | 0.317786887442 | 7, `;:rod23:6` |
> | Rear interval [-3.0,-2.8] | 0.457162734347 | 3, `;:rod23:5` endpoint |
> | Deeper extension [-6.0,-3.0] | 0.481061429772 | 3, `;:rod23:5` endpoint |
>
> Thus a constant-radius stem spanning [-3,0] requires radius below 0.317786887442 mm for positive clearance in the stated placements, or below that value minus an explicitly chosen clearance allowance. Its diameter must fall below 0.635573774884 mm; the current 1 mm diameter cannot survive even with a different support route. Merely extending the current 1 mm stem rearward to find a boss preserves the interior bottleneck. A 0.25 mm radius stem, for example, has a sampled capsule margin of 0.067786887442 mm to the checked rods. This is a geometric example, not a proposed or accepted screw size.
>
> If a full coaxial female boss spans the current [-2.8,-2.0] mm interval, a sufficient rod-clearance condition is `thread-envelope radius + surrounding wall + required clearance < 0.319226546339 mm`. The wall must be positive. For illustration, a 0.25 mm thread-envelope radius and 0.05 mm surrounding wall consume 0.30 mm and leave only 0.019226546339 mm before the rod envelope. No tolerance, strength or fabrication claim follows. A thread profile, load case, material, locknut/head, tooling access and positive engagement through the declared adjustment travel are still absent. The present side crossbrace occupies X[-0.4,2.8], Y[0.25,0.9], Z[-2.8,-2.0] relative to S and is not an enclosing female thread. It cannot be counted as thread engagement just because it overlaps a stem quadrant.
>
> This evidence leaves distinct possible changes open: reduce the screw's estimated diameter and design a real small thread/support; change the estimated axis orientation while preserving nominal contact and recomputing adjustment behavior; or revisit estimated contact placement through an explicitly revised contract. The first option is the only one whose unchanged-axis rod bounds were quantified here. None has been cleared against common linkage, other bank solids, full stroke, tolerances or loads. There is no proof that every finite support is impossible, and no permission here to move frozen rods or silently abandon the datum.
>
> ## Pad and adjustment coverage
>
> The frozen nominal sphere-pad contact is consistent independently. Write H=h_y-S_y=10 mm, D=h_z-S_z=5 mm, C=r-a_z=4.75 mm. At local axial adjustment delta, the selected root satisfies `-H sin(phi)+(D-delta) cos(phi)=C`, and the contact tangent coordinate is `Y=-sqrt(H^2+(D-delta)^2-C^2)`. At delta=-0.1,0,+0.1 mm, the computed contact Y values are -10.1709144131686, -10.1211412399986 and -10.0721149715440 mm, with phi values 0.0346999519141678, 0.0248482065396480 and 0.0149458298718768 rad.
>
> Those values reproduce the frozen face range after its declared 0.4 mm end allowance: Y[-10.5709144131686,-9.6721149715440], X[-0.4,0.4], Z=-4, backing toward +Z. The +/-0.1 mm interval is explicitly illustrative, not a measured or accepted functional adjustment requirement. It is a pad coverage calculation only: the already retained adjusted-setting negative seating reaction remains unresolved. This probe did not shift the whole screw through that interval and clear its thread/head/support, or show any resulting operational calibration. Changing the axial direction, sphere radius or contact-center datum invalidates use of these coverage values without recomputation.
>
> ## Decision and remaining gap
>
> Reject reusing the current straight stem and support unchanged. The obstruction is already present at an ordinary retained held state and has strict finite-material witnesses. Preserve the sphere's positive sampled result, the narrow-axis corridor and all rejected evidence; neither the positive sphere result nor a very small nominal cylinder is a complete engineering solution.
>
> Before spending a final solid-candidate attempt, require a declared finite straight screw, thread and engagement, retaining hardware, boss wall, and continuous support route at explicit dimensions, including how they adjust while the sphere remains connected. Its finite volumes must fit the unchanged rods and common linkage under the fixed checks. A bounded preflight may falsify such a recipe, but this review does not supply a full cleared recipe or authorize acceptance. Historical exactness and arbitrary adjustment coverage are not additional acceptance demands. The actual unresolved requirement is a load-carrying adjustable physical assembly in the given space.
>
> Reproduction: `python probe.py <absolute path to common-lift-candidate4> <output directory>`. `probe-result.json` retains exact input hashes, per-scene minima, strict witnesses and the independent coverage arithmetic. It reads the sibling `common-lift-prototype3/bank-scenes.json`. Product code, candidate geometry and other agents' worktrees were untouched. No task-owned browser, GUI, server or background process was launched. This is read-only evidence, not a code change, so runtime repository gates and CI were not run.

## Findings and disposition

Accept the demonstrated incompatibility of the current 1 mm diameter straight shaft and upright. Preserve the positive sampled sphere clearance and narrow-axis bounds without treating either as a complete hardware design. Source requires an adjusting screw and locknut; the current quadrant crossbrace does not establish real female-thread engagement. No new assembly is accepted.

## Verification

The independent standard-library probe ran once in 0.995 seconds, matched frozen inputs, and retained strict finite-material witnesses. Only the 13 existing placements and seven intervals were checked; complete linkage, swept clearance, loads and manufacturing were not certified.

## Round outcome

The current axis/diameter/support recipe is rejected. Before the remaining fifth construction, revise and explicitly review estimated hardware/contact dimensions or placement, preserving finite load-bearing material and source topology. A narrower cylinder alone is insufficient. No whole-machine dynamics or performance claim follows.
